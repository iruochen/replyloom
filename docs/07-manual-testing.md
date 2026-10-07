# Manual testing

## Load and exercise the extension

1. Run `npm run check`.
2. Open `chrome://extensions`, enable Developer mode, and load `dist/` as an
   unpacked extension. Review the manifest permissions before loading.
3. Open a normal X post and select its AI reply control. Confirm the correct
   source context appears. Repeat on a post detail page and quoted post.
4. Test docked and floating panel modes.
5. Configure a supported provider with your own API key. Confirm Chrome asks
   for permission for that provider's origin.
6. Test connection and model listing, then generate three candidates.
7. Edit and copy a candidate. Insert it into the intended reply editor and
   confirm the final Reply/Post control is never activated.
8. Test Chinese and English interfaces, generation preferences, custom voice
   instructions, keyboard focus, and narrow panel widths.
9. Check invalid credentials, invalid models, rate limits, timeouts, and malformed
   provider responses. Confirm an insertion failure leaves copying available.
10. Test key persistence with the save-key option enabled, and session-only key
    removal after restarting the browser with the option disabled.

## Optional live provider tests

Normal tests mock network requests. Live tests use your credentials and quota;
provide credentials through environment variables without committing or logging
them.

- `npm run test:live:provider` requires `LIVE_PROVIDER_PRESET` and
  `LIVE_PROVIDER_API_KEY`; optional inputs include `LIVE_PROVIDER_MODEL` and
  `LIVE_PROVIDER_BASE_URL`. Endpoints remain subject to the provider allowlist.
- `npm run test:live:minimax` requires `MINIMAX_API_KEY`.

Use MiniMax to exercise its provider-specific path and one other supported
provider to exercise the shared OpenAI-compatible path. Remove private data
from any test report or screenshot.
