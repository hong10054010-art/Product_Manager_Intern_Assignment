// Main Worker entry point
// Import API handlers
import { onRequestGet as queryHandler } from '../functions/api/query.js';
import { onRequestPost as seedHandler } from '../functions/api/seed.js';
import { onRequestPost as processHandler } from '../functions/api/process.js';
import { onRequestPost as aiAdviceHandler } from '../functions/api/ai-advice.js';
import { onRequestPost as saveViewPostHandler, onRequestGet as saveViewGetHandler } from '../functions/api/save-view.js';

// Import HTML content as a string
// This will be bundled at build time
import indexHTML from '../index.html?raw';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle API routes
    if (path.startsWith('/api/')) {
      return handleAPI(request, env, ctx, path);
    }

    // Serve index.html for root and SPA routes
    // First try ASSETS binding (if available)
    if (env.ASSETS) {
      try {
        const assetPath = path === '/' ? '/index.html' : path;
        const assetRequest = new Request(new URL(assetPath, request.url).toString(), {
          method: request.method,
          headers: request.headers,
        });
        const assetResponse = await env.ASSETS.fetch(assetRequest);
        
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch (e) {
        console.error('Error fetching asset:', e);
      }
    }

    // Fallback: serve embedded HTML for SPA routes
    if (path === '/' || path === '/index.html' || !path.includes('.')) {
      return new Response(indexHTML, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
        },
      });
    }

    // 404 for other paths
    return new Response('Not Found', { status: 404 });
  },
};

async function handleAPI(request, env, ctx, path) {
  try {
    // Route to appropriate API handler
    if (path === '/api/query') {
      return await queryHandler({ env, request });
    } else if (path === '/api/seed') {
      if (request.method === 'POST') {
        return await seedHandler({ env, request });
      }
    } else if (path === '/api/process') {
      if (request.method === 'POST') {
        return await processHandler({ env, request });
      }
    } else if (path === '/api/ai-advice') {
      if (request.method === 'POST') {
        return await aiAdviceHandler({ env, request });
      }
    } else if (path === '/api/save-view') {
      if (request.method === 'POST') {
        return await saveViewPostHandler({ env, request });
      } else if (request.method === 'GET') {
        return await saveViewGetHandler({ env, request });
      }
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
