/**
 * Local five-pass read of the Rork stability checklist and the React hooks
 * safety guide. Reads this repo only. No phone, card, dashboard, or secret.
 *
 * Each pass re-reads the files. Role outcomes are the shared gate in
 * app/index.tsx and the shared tab layout.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const passes = 5;

const read = (path) => readFileSync(join(root, path), 'utf8');

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'coverage' || name === '.expo') continue;
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(full);
  }
  return out;
};

const sourceFile = (path, text) =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

const isHookName = (name) => /^use[A-Z0-9]/.test(name);

const hookNameOf = (node) => {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  if (ts.isIdentifier(callee) && isHookName(callee.text)) return callee.text;
  if (
    ts.isPropertyAccessExpression(callee) &&
    isHookName(callee.name.text) &&
    (callee.expression.kind === ts.SyntaxKind.Identifier || ts.isPropertyAccessExpression(callee.expression))
  ) {
    return callee.name.text;
  }
  return null;
};

const functionName = (node) => {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node)) && node.name) {
    return node.name.text;
  }
  let current = node.parent;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
    if (ts.isCallExpression(current)) {
      current = current.parent;
      continue;
    }
    break;
  }
  return null;
};

const isComponentOrHook = (node) => {
  const name = functionName(node);
  if (name && (isHookName(name) || /^_?[A-Z]/.test(name))) return true;
  const parent = node.parent;
  if (!parent || !ts.isCallExpression(parent)) return false;
  const callee = parent.expression;
  const calleeName = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : '';
  return calleeName === 'createContextHook' || calleeName === 'memo' || calleeName === 'forwardRef';
};

const enclosingFunction = (node) => {
  let current = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isConstructorDeclaration(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
};

const bindingNames = (name, out = []) => {
  if (!name) return out;
  if (ts.isIdentifier(name)) out.push(name.text);
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) bindingNames(element.name, out);
    }
  }
  return out;
};

const collectScopeBindings = (body, scopeStart) => {
  const bindings = [];
  const visit = (node, nested) => {
    if (nested) return;
    if (
      node !== body &&
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isClassDeclaration(node))
    ) {
      return;
    }
    if (ts.isVariableDeclaration(node) && node.name && node.parent && ts.isVariableDeclarationList(node.parent)) {
      const lexical = (node.parent.flags & ts.NodeFlags.Let) !== 0 || (node.parent.flags & ts.NodeFlags.Const) !== 0;
      if (lexical) {
        for (const name of bindingNames(node.name)) bindings.push({ name, pos: node.name.getStart() });
      }
    }
    ts.forEachChild(node, (child) => visit(child, false));
  };
  if (ts.isFunctionLike(body) || ts.isConstructorDeclaration(body)) {
    for (const param of body.parameters || []) {
      for (const name of bindingNames(param.name)) bindings.push({ name, pos: scopeStart });
    }
    if (body.body) visit(body.body, false);
  }
  return bindings;
};

const scanHooks = (file, text) => {
  const source = sourceFile(file, text);
  const issues = [];
  const rel = relative(root, file);

  const visit = (node) => {
    const name = hookNameOf(node);
    if (name) {
      const owner = enclosingFunction(node);
      if (!owner) {
        issues.push(`${rel}: ${name} is outside a function`);
      } else if (!isComponentOrHook(owner)) {
        issues.push(`${rel}: ${name} is inside a nested function`);
      } else {
        let between = node.parent;
        let nested = false;
        while (between && between !== owner) {
          if (
            ts.isFunctionDeclaration(between) ||
            ts.isFunctionExpression(between) ||
            ts.isArrowFunction(between) ||
            ts.isMethodDeclaration(between)
          ) {
            if (!isComponentOrHook(between)) nested = true;
          }
          if (
            ts.isIfStatement(between) ||
            ts.isForStatement(between) ||
            ts.isForInStatement(between) ||
            ts.isForOfStatement(between) ||
            ts.isWhileStatement(between) ||
            ts.isDoStatement(between) ||
            ts.isSwitchStatement(between) ||
            ts.isConditionalExpression(between) ||
            ts.isCatchClause(between)
          ) {
            issues.push(`${rel}: ${name} is inside a conditional, a loop, or a catch`);
          }
          between = between.parent;
        }
        if (nested) issues.push(`${rel}: ${name} is inside a nested function`);

        const laterReturn = (statementParent) => {
          const returns = [];
          const walkReturn = (current, inNested) => {
            if (
              current !== owner &&
              (ts.isFunctionDeclaration(current) ||
                ts.isFunctionExpression(current) ||
                ts.isArrowFunction(current) ||
                ts.isMethodDeclaration(current))
            ) {
              return;
            }
            if (ts.isReturnStatement(current) && current.getEnd() < node.getStart()) returns.push(current);
            ts.forEachChild(current, (child) => walkReturn(child, inNested));
          };
          if (owner.body) walkReturn(owner.body, false);
          if (returns.length > 0) issues.push(`${rel}: ${name} runs after a conditional return`);
        };
        laterReturn();

        const deps = node.arguments[node.arguments.length - 1];
        if (deps && ts.isArrayLiteralExpression(deps)) {
          const bindings = collectScopeBindings(owner, owner.getStart());
          for (const element of deps.elements) {
            if (!ts.isIdentifier(element)) continue;
            const matches = bindings.filter((binding) => binding.name === element.text);
            const nearest = matches.sort((a, b) => b.pos - a.pos).find((binding) => binding.pos <= deps.getEnd()) || matches[0];
            if (nearest && nearest.pos > node.getStart()) {
              issues.push(`${rel}: ${element.text} is named in a dependency array before it is defined`);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return issues;
};

const navigationFiles = [
  'app/_layout.tsx',
  'app/index.tsx',
  'app/(tabs)/_layout.tsx',
  'app/meal/[id].tsx',
  'components/ErrorBoundary.tsx',
  'components/launch-cover.tsx',
  'lib/nav-logger.ts',
];

const callNames = (text, path) => {
  const source = sourceFile(path, text);
  const names = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) names.push(callee.text);
      else if (ts.isPropertyAccessExpression(callee)) names.push(callee.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

const checks = () => {
  const indexText = read('app/index.tsx');
  const tabsText = read('app/(tabs)/_layout.tsx');
  const rootText = read('app/_layout.tsx');
  const mealText = read('app/meal/[id].tsx');
  const launchText = read('components/launch-cover.tsx');
  const results = [];

  const indexCalls = callNames(indexText, 'app/index.tsx');
  const indexHasReplaceEffect =
    /useEffect\(/.test(indexText) && /router\.replace\(/.test(indexText);
  results.push({
    id: 'index-no-replace-effect',
    pass: !indexHasReplaceEffect && !indexCalls.includes('useEffect') && !indexCalls.includes('replace'),
    detail: 'app/index.tsx has no useEffect and no router.replace. Signed out, both roles use Redirect to welcome. Signed in, a PlateMaker goes to membership or the dashboard. A PlateTaker goes to home.',
  });

  const signedOutBlock = tabsText.slice(tabsText.indexOf('if (!isAuthenticated)'));
  const signedOutReturn = signedOutBlock.slice(0, signedOutBlock.indexOf('if (userNeedsMembership'));
  results.push({
    id: 'tabs-signed-out-redirect',
    pass:
      signedOutReturn.includes('<Redirect href="/(auth)/login" />') &&
      !signedOutReturn.includes('return null'),
    detail: 'A signed-out PlateMaker and a signed-out PlateTaker share the tab layout redirect to login. return null stays on the web loading fill, before a session is known.',
  });

  const rootMountsInsideTimer = /setTimeout\(/.test(rootText);
  const launchMountsSlotInTimer = /setTimeout\([\s\S]{0,180}children/.test(launchText);
  results.push({
    id: 'no-timeout-mount',
    pass: !rootMountsInsideTimer && !launchMountsSlotInTimer && rootText.includes('onLayout={onLayoutRootView}') && launchText.includes('{children}'),
    detail: 'Native mounts the slot under LaunchCover when the root view lays out. The cover timers only lift the dark fill. Web renders the slot on the first pass.',
  });

  const modalFiles = walk(join(root, 'app')).filter((file) => readFileSync(file, 'utf8').includes("presentation: 'modal'") || readFileSync(file, 'utf8').includes('presentation: "modal"'));
  const modalMisses = modalFiles.filter((file) => !readFileSync(file, 'utf8').includes('<Stack.Screen'));
  results.push({
    id: 'modal-stack-screen',
    pass: modalFiles.length > 0 && modalMisses.length === 0 && mealText.includes('<Stack.Screen'),
    detail: `Modal presentation files: ${modalFiles.map((file) => relative(root, file)).join(', ') || 'none'}. Each includes Stack.Screen. The meal screen is the shared plate view for both roles.`,
  });

  const inlineFetch = [];
  for (const path of navigationFiles) {
    const text = read(path);
    const source = sourceFile(path, text);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
        inlineFetch.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const navLoggerUsed = ['app/index.tsx', 'app/(tabs)/_layout.tsx', 'app/_layout.tsx', 'app/meal/[id].tsx'].every((path) =>
    read(path).includes('navLogger')
  );
  results.push({
    id: 'nav-logger-not-fetch',
    pass: inlineFetch.length === 0 && navLoggerUsed && !read('lib/nav-logger.ts').includes('fetch('),
    detail: inlineFetch.length === 0 ? 'Navigation files log through navLogger. No inline fetch() call is in those files.' : `Inline fetch() at ${inlineFetch.join(', ')}`,
  });

  let namedBoundary = '';
  try {
    namedBoundary = read('components/NavigationErrorBoundary.tsx');
  } catch {
    namedBoundary = '';
  }
  const webWrapsBoundary = rootText.includes('<NavigationErrorBoundary>') && rootText.includes('</NavigationErrorBoundary>');
  const nativeReturn = rootText.slice(rootText.lastIndexOf('return ('));
  const nativeWrapsBoundary = nativeReturn.includes('<NavigationErrorBoundary>') && nativeReturn.includes('</NavigationErrorBoundary>');
  const boundaryUsesSentry = namedBoundary.includes("from '@/lib/sentry'") && namedBoundary.includes('Sentry.captureException') && namedBoundary.includes("area: 'navigation'");
  const boundaryUsesNavLogger = namedBoundary.includes('navLogger.error');
  results.push({
    id: 'navigation-error-boundary',
    pass: webWrapsBoundary && nativeWrapsBoundary && boundaryUsesSentry && boundaryUsesNavLogger && !namedBoundary.includes('fetch('),
    detail: webWrapsBoundary && nativeWrapsBoundary && boundaryUsesSentry
      ? 'NavigationErrorBoundary wraps the web return and the native return. It reports to Sentry with area navigation and logs through navLogger. PlateMaker and PlateTaker share that wrap.'
      : 'NavigationErrorBoundary is missing from a platform return, from Sentry, or from navLogger.',
  });

  const rootSource = sourceFile('app/_layout.tsx', rootText);
  let webHasContainer = false;
  const visitWeb = (node) => {
    if (ts.isIfStatement(node) && node.thenStatement.getText(rootSource).includes('independent: true')) {
      webHasContainer = node.thenStatement.getText(rootSource).includes('<NavigationContainer');
    }
    ts.forEachChild(node, visitWeb);
  };
  visitWeb(rootSource);
  const nativeBranch = rootText.slice(rootText.lastIndexOf('return ('));
  results.push({
    id: 'web-independent-container',
    pass: webHasContainer,
    detail: webHasContainer
      ? 'The web branch wraps NavigationContainer with independent: true. PlateMaker and PlateTaker share that branch.'
      : 'The web branch does not wrap NavigationContainer with independent: true.',
  });
  results.push({
    id: 'native-no-container',
    pass: !nativeBranch.includes('NavigationContainer') && rootText.includes("Platform.OS === 'web'"),
    detail: 'The native return does not add NavigationContainer. iOS and Android share that branch. Web is the only branch that adds one.',
  });

  const hookRoots = [join(root, 'app'), join(root, 'components'), join(root, 'hooks')];
  const hookIssues = [];
  for (const dir of hookRoots) {
    for (const file of walk(dir)) {
      if (file.includes(`${join('node_modules')}`)) continue;
      if (/\.(test|spec)\./.test(file)) continue;
      hookIssues.push(...scanHooks(file, readFileSync(file, 'utf8')));
    }
  }
  const uniqueHooks = [...new Set(hookIssues)];
  results.push({
    id: 'hooks-top-level',
    pass: uniqueHooks.filter((issue) => issue.includes('outside a function') || issue.includes('nested function') || issue.includes('conditional')).length === 0,
    detail: uniqueHooks.filter((issue) => !issue.includes('dependency array') && !issue.includes('conditional return')).slice(0, 12).join(' | ') || 'Hooks in app, components, and hooks stay at the top level of a component or a hook.',
  });
  results.push({
    id: 'hooks-after-return',
    pass: uniqueHooks.filter((issue) => issue.includes('conditional return')).length === 0,
    detail: uniqueHooks.filter((issue) => issue.includes('conditional return')).slice(0, 12).join(' | ') || 'No hook call is after a return in the same function.',
  });
  results.push({
    id: 'hooks-not-in-conditional',
    pass: uniqueHooks.filter((issue) => issue.includes('inside a conditional') || issue.includes('nested function')).length === 0,
    detail: uniqueHooks.filter((issue) => issue.includes('inside a conditional') || issue.includes('nested function')).slice(0, 12).join(' | ') || 'No hook call is inside a conditional, a loop, or a nested function.',
  });
  results.push({
    id: 'deps-defined-before',
    pass: uniqueHooks.filter((issue) => issue.includes('dependency array')).length === 0,
    detail: uniqueHooks.filter((issue) => issue.includes('dependency array')).slice(0, 12).join(' | ') || 'Names in dependency arrays are declared before that array.',
  });

  results.push({
    id: 'role-gate',
    pass:
      indexText.includes("userRole === 'platemaker'") &&
      indexText.includes('/(tabs)/dashboard') &&
      indexText.includes('/membership') &&
      indexText.includes('/(tabs)/(home)/home') &&
      indexText.includes('/(auth)/welcome') &&
      tabsText.includes("user?.role === 'platemaker'") &&
      tabsText.includes('href: isPlatemaker ? undefined : null') &&
      tabsText.includes('href: isPlatemaker ? null : undefined'),
    detail: 'Signed out, both roles leave the gate for welcome. Signed in, PlateMaker membership or dashboard, PlateTaker home. Tabs hide the cook screens from a buyer and the cart from a cook.',
  });

  return { results, hookIssues: uniqueHooks };
};

const runs = [];
for (let pass = 1; pass <= passes; pass += 1) {
  const { results, hookIssues } = checks();
  const failed = results.filter((item) => !item.pass);
  runs.push({ pass, failed: failed.map((item) => item.id), hookIssues });
  console.log(`PASS ${pass}`);
  for (const item of results) {
    console.log(`${item.pass ? 'ok' : 'FAIL'} ${item.id}`);
    console.log(`  ${item.detail}`);
  }
  console.log('');
}

const same = runs.every((run) => run.failed.join('|') === runs[0].failed.join('|'));
console.log(JSON.stringify({ passes, same, failed: runs[0].failed, hookIssueCount: runs[0].hookIssues.length }, null, 2));
if (!same || runs[0].failed.length > 0) process.exitCode = 1;
