import type {EntryContext} from '@shopify/remix-oxygen';
import {RemixServer} from '@remix-run/react';
import isbot from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';
import {createInstance} from 'i18next';
import {I18nextProvider, initReactI18next} from 'react-i18next';
import type {HttpBackendOptions} from 'i18next-http-backend';

// import translations directly as other i18n backends don't work on Vercel
// @see https://github.com/sergiodxa/remix-i18next/issues/47#issuecomment-1056851755
// @see https://github.com/sergiodxa/remix-i18next/issues/47#issuecomment-1245627494
import enCommon from '../public/locales/en/common.json';
import deCommon from '../public/locales/de/common.json';

import i18next from './i18next.server';
import i18n from './i18n'; // your i18n configuration file

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  const instance = createInstance();
  const url = new URL(request.url);
  const lng = url.pathname.startsWith('/de-de') ? 'de' : 'en';
  const ns = i18next.getRouteNamespaces(remixContext);

  await instance
    .use(initReactI18next) // Tell our instance to use react-i18next
    .init<HttpBackendOptions>({
      ...i18n, // spread the configuration
      lng, // The locale we detected above
      ns, // The namespaces the routes about to render wants to use
      // import translations directly as other i18n backends don't work on Vercel
      // @see https://github.com/sergiodxa/remix-i18next/issues/47#issuecomment-1056851755
      // @see https://github.com/sergiodxa/remix-i18next/issues/47#issuecomment-1245627494
      resources: {
        en: {common: enCommon},
        de: {common: deCommon},
      },
    });

  const {nonce, header, NonceProvider} = createContentSecurityPolicy();
  const body = await renderToReadableStream(
    <I18nextProvider i18n={instance}>
      <NonceProvider>
        <RemixServer context={remixContext} url={request.url} />
      </NonceProvider>
    </I18nextProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        // eslint-disable-next-line no-console
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
