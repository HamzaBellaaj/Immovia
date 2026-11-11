const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
// Doubles reseau reserves aux tests : aucune authentification fictive dans l'application.
const output = path.resolve(__dirname, '../test-results');
fs.mkdirSync(output, { recursive: true });
const appRoot = path.resolve(__dirname, process.env.APP_BUILD_PATH || '../dist/immovia-frontend/browser');
const maquettesRoot = path.resolve(__dirname, '../../maquettes');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const reference = url.pathname.startsWith('/__maquettes/');
  const root = reference ? maquettesRoot : appRoot;
  const requested = reference ? url.pathname.slice('/__maquettes'.length) : url.pathname;
  let file = path.resolve(root, '.' + decodeURIComponent(requested));
  if (file !== root && !file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  if (!fs.existsSync(file)) {
    response.writeHead(404).end('Executer npm run build avant les tests.');
    return;
  }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
let base;
const uid = '6b588f68-a39a-49f1-b30b-91b77b134729';
const user = {
  id: uid,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { prenom: 'Amira', nom: 'Test' },
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: uid, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })}.test-fixture-signature`;
const session = {
  access_token: token,
  refresh_token: 'test-fixture-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  user,
};
const profile = {
  id: uid,
  firstName: 'Amira',
  lastName: 'Test',
  email: user.email,
  phone: '+216 22 333 444',
  isOwner: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const key = 'sb-koihgmmtxqlbuexewurx-auth-token';
const results = [];
const errors = [];
let browser;

async function makeContext(options = {}) {
  const context = await browser.newContext({
    viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  });
  context.setDefaultTimeout(15000);
  const requests = [];
  let serverProfile = { ...profile };
  context.on('page', (page) => page.on('pageerror', (err) => errors.push(err.message)));
  await context.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, body: '' }),
  );
  await context.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await context.route('**/auth/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({
      path: url.pathname,
      query: url.searchParams,
      method: request.method(),
      body: request.postDataJSON(),
      headers: request.headers(),
    });
    const send = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'x-supabase-api-version': '2024-01-01' },
        body: JSON.stringify(body),
      });
    if (options.authError && url.pathname.endsWith('/token'))
      return send(
        {
          code: 'invalid_credentials',
          error_code: 'invalid_credentials',
          message: 'Invalid login credentials',
        },
        400,
      );
    if (url.pathname.endsWith('/signup'))
      return send({ user: { ...user, email_confirmed_at: null }, session: null });
    if (url.pathname.endsWith('/token')) return send(session);
    if (url.pathname.endsWith('/user')) return send(user);
    if (url.pathname.endsWith('/logout')) return send({});
    if (url.pathname.endsWith('/recover')) return send({});
    return send({ code: 'unexpected_test_request' }, 400);
  });
  await context.route('http://localhost:8000/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    requests.push({
      path: pathname,
      method: request.method(),
      headers: request.headers(),
      body: request.postDataJSON(),
    });
    if (options.backendDown) return route.abort('connectionrefused');
    if (request.method() === 'PUT') serverProfile = { ...serverProfile, ...request.postDataJSON() };
    if (pathname.endsWith('/become-owner')) serverProfile.isOwner = true;
    if (options.invalidProfile) serverProfile = { id: uid };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pathname.endsWith('/me') ? serverProfile : {}),
    });
  });
  if (options.storedSession)
    await context.addInitScript(
      ({ key, session, base }) => {
        if (location.origin === base)
          localStorage.setItem(
            key,
            JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + 3600 }),
          );
      },
      { key, session, base },
    );
  if (options.pkce)
    await context.addInitScript(
      ({ key, recovery, base }) => {
        if (location.origin === base)
          localStorage.setItem(
            key + '-code-verifier',
            JSON.stringify('test-verifier' + (recovery ? '/recovery' : '')),
          );
      },
      { key, recovery: options.pkce === 'recovery', base },
    );
  return { context, page: await context.newPage(), requests };
}
async function test(name, run) {
  await run();
  results.push(name);
  console.log('PASS ' + name);
}

(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true,
  });
  await test('Routes publiques, validation en français, protection et responsive', async () => {
    const { context, page } = await makeContext();
    await page.goto(base + '/connexion');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await page.getByText('Ce champ est obligatoire.').first().waitFor();
    assert.equal(await page.getByText('Ce champ est obligatoire.').count(), 2);
    await page.locator('#login-password').fill('bonjour');
    await page.getByRole('button', { name: 'Afficher le mot de passe' }).click();
    await page.locator('#login-password[type="text"]').waitFor();
    assert.equal(await page.locator('#login-password').getAttribute('type'), 'text');
    await page.screenshot({
      path: path.join(output, 'connexion-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    });
    const reference = await context.newPage();
    await reference.goto(base + '/__maquettes/connexion.html');
    await reference.screenshot({
      path: path.join(output, 'maquette-connexion-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await reference.close();
    for (const route of ['/profil', '/devenir-proprietaire']) {
      await page.goto(base + route);
      await page.waitForURL('**/connexion');
    }
    for (const route of [
      '/inscription',
      '/verification-email',
      '/mot-de-passe-oublie',
      '/nouveau-mot-de-passe',
      '/auth/callback',
    ]) {
      await page.goto(base + route);
      await page.getByRole('heading', { level: 1 }).waitFor();
    }
    await page.goto(base + '/nouveau-mot-de-passe');
    await page.getByText('Le lien de récupération est absent ou expiré.').waitFor();
    assert.equal(await page.locator('#reset-password').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/inscription');
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: path.join(output, 'inscription-mobile.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await context.close();
  });
  await test('Inscription : métadonnées, téléphone facultatif, aucun accès avant confirmation', async () => {
    const { context, page, requests } = await makeContext();
    await page.goto(base + '/inscription');
    await page.locator('#signup-prenom').fill('Amira');
    await page.locator('#signup-nom').fill('Test');
    await page.locator('#signup-email').fill(user.email);
    await page.locator('#signup-password').fill('MotdePasse-Test-123!');
    await page.locator('#signup-confirm').fill('Autre-123!');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await page.getByText('Les deux mots de passe doivent être identiques.').waitFor();
    assert(!requests.some((r) => r.path.endsWith('/signup')));
    await page.locator('#signup-confirm').fill('MotdePasse-Test-123!');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await page.waitForURL('**/verification-email');
    const signup = requests.find((r) => r.path.endsWith('/signup'));
    assert(signup);
    assert.equal(signup.body.data.prenom, 'Amira');
    assert.equal(signup.body.data.telephone, '');
    assert.equal(signup.query.get('redirect_to'), base + '/auth/callback');
    await page.goto(base + '/profil');
    await page.waitForURL('**/connexion');
    await context.close();
  });
  await test('Connexion refusée : message français sans faux succès', async () => {
    const { context, page } = await makeContext({ authError: true });
    await page.goto(base + '/connexion');
    await page.locator('#login-email').fill(user.email);
    await page.locator('#login-password').fill('incorrect');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await page.getByText('Adresse e-mail ou mot de passe incorrect.').waitFor();
    assert(page.url().endsWith('/connexion'));
    await context.close();
  });
  await test('Connexion, sync puis GET avec Bearer, modification, activation et déconnexion', async () => {
    const { context, page, requests } = await makeContext();
    await page.goto(base + '/connexion');
    await page.locator('#login-email').fill(user.email);
    await page.locator('#login-password').fill('MotdePasse-Test-123!');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await page.waitForURL('**/profil');
    await page.locator('#profile-prenom').waitFor();
    const privateRequests = requests.filter((r) => r.path.startsWith('/api/profile/'));
    assert.equal(await page.locator('#profile-prenom').inputValue(), profile.firstName);
    assert.equal(await page.locator('#profile-nom').inputValue(), profile.lastName);
    assert.equal(await page.locator('#profile-phone').inputValue(), profile.phone);
    assert.equal(await page.locator('#profile-email').inputValue(), user.email);
    assert.equal(privateRequests[0].path, '/api/profile/sync');
    assert.equal(privateRequests[1].path, '/api/profile/me');
    for (const request of privateRequests)
      assert.equal(request.headers.authorization, 'Bearer ' + token);
    await page.locator('#profile-prenom').fill('Amira modifiée');
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await page.getByText('Vos informations ont été enregistrées.').waitFor();
    assert(
      requests.some(
        (r) =>
          r.method === 'PUT' &&
          r.body.firstName === 'Amira modifiée' &&
          !('email' in r.body) &&
          !('isOwner' in r.body),
      ),
    );
    await page.reload();
    await page.locator('#profile-prenom').waitFor();
    assert.equal(await page.locator('#profile-prenom').inputValue(), 'Amira modifiée');
    await page.screenshot({
      path: path.join(output, 'profil-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('link', { name: 'Devenir propriétaire', exact: false }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Activer mon espace propriétaire' }).click();
    await page.getByText('Votre profil propriétaire est activé !', { exact: false }).waitFor();
    await page.screenshot({
      path: path.join(output, 'proprietaire-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.getByRole('button', { name: 'Se déconnecter' }).isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await page.waitForURL('**/connexion');
    await context.close();
  });
  await test('Token Postman : copie en developpement uniquement, sans affichage ni stockage supplementaire', async () => {
    const { context, page } = await makeContext({ storedSession: true });
    const consoleMessages = [];
    page.on('console', (message) => consoleMessages.push(message.text()));
    await page.addInitScript(() => {
      window.__clipboardCopies = [];
      window.__clipboardDenied = false;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (value) => {
          if (window.__clipboardDenied) throw new Error('clipboard denied');
          window.__clipboardCopies.push(value);
        } },
      });
    });
    await page.goto(base + '/profil');
    await page.locator('#profile-prenom').waitFor();
    const button = page.getByRole('button', { name: 'Copier le token pour Postman', exact: true });
    if (process.env.EXPECT_POSTMAN_TOOLS === 'true') {
      await button.waitFor();
      const storedBefore = await page.evaluate(() => ({ ...localStorage }));
      await button.click();
      await page.getByText('Token copié.', { exact: false }).waitFor();
      const copies = await page.evaluate(() => window.__clipboardCopies);
      // Ne jamais afficher la valeur dans une assertion, meme en cas d'echec.
      assert(copies.length === 1 && copies[0] === token, 'Copie du seul access_token attendue');
      assert(JSON.stringify(await page.evaluate(() => ({ ...localStorage }))) === JSON.stringify(storedBefore),
        'Aucun stockage supplementaire attendu');
      assert(!(await page.content()).includes(token), 'Le token ne doit pas apparaitre dans le HTML');
      assert(!consoleMessages.some((message) => message.includes(token)), 'Aucun token dans les logs');
      await page.evaluate(() => { window.__clipboardDenied = true; });
      await button.click();
      await page.getByText('Copie impossible.', { exact: false }).waitFor();
      assert((await page.evaluate(() => window.__clipboardCopies.length)) === 1);
      assert(!(await page.content()).includes(token));
    } else {
      assert.equal(await button.count(), 0, 'Bouton absent du build de production');
      assert((await page.evaluate(() => window.__clipboardCopies.length)) === 0);
    }
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await page.waitForURL('**/connexion');
    assert.equal(await button.count(), 0);
    await context.close();
  });
  await test('Backend indisponible : erreur visible, aucune donnée de profil inventée', async () => {
    const { context, page } = await makeContext({ storedSession: true, backendDown: true });
    await page.goto(base + '/profil');
    await page.getByText('Le service de profil est injoignable.', { exact: false }).waitFor();
    assert.equal(await page.locator('#profile-prenom').count(), 0);
    await page.goto(base + '/devenir-proprietaire');
    await page.getByText('Le service de profil est injoignable.', { exact: false }).waitFor();
    assert(
      await page.getByRole('button', { name: 'Activer mon espace propriétaire' }).isDisabled(),
    );
    await context.close();
  });
  await test('Mot de passe oublié : appel Supabase et message neutre', async () => {
    const { context, page, requests } = await makeContext();
    await page.goto(base + '/mot-de-passe-oublie');
    await page.locator('#forgot-email').fill(user.email);
    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await page.getByText('Si un compte correspond à cette adresse,', { exact: false }).waitFor();
    const request = requests.find((r) => r.path.endsWith('/recover'));
    assert(request);
    assert.equal(request.query.get('redirect_to'), base + '/auth/callback');
    await context.close();
  });
  await test('Retour confirmation implicite : session, URL nettoyée et synchronisation', async () => {
    const { context, page, requests } = await makeContext();
    await page.goto(
      base +
        '/verification-email#access_token=' +
        token +
        '&refresh_token=test-fixture-refresh&type=signup',
    );
    await page.waitForURL('**/profil');
    await page.locator('#profile-prenom').waitFor();
    assert(!page.url().includes('access_token'));
    assert(requests.some((r) => r.path === '/api/profile/sync'));
    await context.close();
  });
  await test('Retour OAuth PKCE : échange du code et redirection profil', async () => {
    const { context, page, requests } = await makeContext({ pkce: 'oauth' });
    await page.goto(base + '/auth/callback?code=test-oauth-code');
    await page.waitForURL('**/profil');
    await page.locator('#profile-prenom').waitFor();
    assert(requests.some((r) => r.query?.get('grant_type') === 'pkce'));
    await context.close();
  });
  await test('Google : URL OAuth Supabase, PKCE et adresse de retour Angular', async () => {
    const { context, page, requests } = await makeContext();
    await context.route('**/auth/v1/authorize?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<p>Destination OAuth de test</p>',
      }),
    );
    await page.goto(base + '/connexion');
    await page.getByRole('button', { name: 'Continuer avec Google' }).click();
    await page.waitForURL('**/auth/v1/authorize?**');
    const url = new URL(page.url());
    assert.equal(url.searchParams.get('provider'), 'google');
    assert.equal(url.searchParams.get('scopes'), 'openid email profile');
    assert.equal(url.searchParams.get('redirect_to'), base + '/auth/callback');
    assert(url.searchParams.get('code_challenge'));
    assert(!requests.some((r) => r.path.startsWith('/api/')));
    await context.close();
  });
  await test('Session ordinaire : formulaire de récupération refusé', async () => {
    const { context, page } = await makeContext({ storedSession: true });
    await page.goto(base + '/nouveau-mot-de-passe');
    await page.getByText('Le lien de récupération est absent ou expiré.').waitFor();
    assert.equal(await page.locator('#reset-password').count(), 0);
    await context.close();
  });
  await test('DTO incompatible : erreur explicite sans profil inventé', async () => {
    const { context, page } = await makeContext({ storedSession: true, invalidProfile: true });
    await page.goto(base + '/profil');
    await page
      .getByText('Le service de profil a renvoyé un format inattendu.', { exact: false })
      .waitFor();
    assert.equal(await page.locator('#profile-prenom').count(), 0);
    await context.close();
  });
  await test('Récupération PKCE : PASSWORD_RECOVERY, rechargement, updateUser et retour connexion', async () => {
    const { context, page, requests } = await makeContext({ pkce: 'recovery' });
    await page.goto(base + '/auth/callback?code=test-recovery-code');
    await page.waitForURL('**/nouveau-mot-de-passe');
    await page.locator('#reset-password').waitFor();
    assert(!requests.some((r) => r.path === '/api/profile/sync'));
    await page.reload();
    await page.locator('#reset-password').waitFor();
    await page.locator('#reset-password').fill('Nouveau-MotdePasse-123!');
    await page.locator('#reset-confirm').fill('Nouveau-MotdePasse-123!');
    await page.getByRole('button', { name: 'Enregistrer mon mot de passe' }).click();
    await page.getByText('Votre mot de passe a été modifié.', { exact: false }).waitFor();
    assert(
      requests.some(
        (r) =>
          r.path.endsWith('/user') &&
          r.method === 'PUT' &&
          r.body.password === 'Nouveau-MotdePasse-123!',
      ),
    );
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await page.waitForURL('**/connexion');
    await page.goto(base + '/nouveau-mot-de-passe');
    await page.getByText('Le lien de récupération est absent ou expiré.').waitFor();
    await context.close();
  });
  await test('Récupération implicite depuis racine et lien expiré', async () => {
    const { context, page } = await makeContext();
    await page.goto(
      base + '/#access_token=' + token + '&refresh_token=test-fixture-refresh&type=recovery',
    );
    await page.waitForURL('**/nouveau-mot-de-passe');
    await page.locator('#reset-password').waitFor();
    await page.goto(
      base +
        '/auth/callback#error=access_denied&error_code=otp_expired&error_description=private-fixture',
    );
    await page
      .getByText('Ce lien est expiré, déjà utilisé ou ouvert dans un autre navigateur.', {
        exact: false,
      })
      .waitFor();
    assert(!page.url().includes('private-fixture'));
    await context.close();
  });
  assert.deepEqual(errors, [], 'Erreurs navigateur');
  console.log(`${results.length} vérifications réussies, aucune erreur JavaScript.`);
})()
  .catch((err) => {
    console.error(err.message.replace(/(access_token|refresh_token|token_hash|code)=[^&\s"']+/g, '$1=[redacted]'));
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server.close();
  });
