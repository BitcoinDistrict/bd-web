# iOS Safari Asset Loading Fix

## Problem
Directus assets (images, audio files) were not loading on iOS Safari, while working fine on desktop browsers. This was caused by missing CORS headers and restrictive Content Security Policy settings.

## Solution Implemented

### 1. CORS Headers in Caddyfile
Added CORS headers to the `/assets*` endpoint in `admin.bitcoindistrict.org` block:
- `Access-Control-Allow-Origin: https://staging.bitcoindistrict.org`
- `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`
- `Access-Control-Allow-Headers: Range` (needed for audio streaming)
- `Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges`
- OPTIONS preflight requests return 204

### 2. Content Security Policy for Assets
Added `ASSETS_CONTENT_SECURITY_POLICY` to Directus configuration:
```
default-src 'self'; img-src 'self' data: https:; media-src 'self' data: https:;
```

This allows:
- Images from same origin, data URIs, and HTTPS sources
- Media files (audio/video) from same origin, data URIs, and HTTPS sources

## Deployment Steps

1. **Deploy changes to production server**
2. **Restart Caddy container**:
   ```bash
   docker-compose -f docker-compose.prod.yml restart caddy
   ```
3. **Restart Directus container**:
   ```bash
   docker-compose -f docker-compose.prod.yml restart directus
   ```
4. **Verify Caddy reloaded config**:
   ```bash
   docker-compose -f docker-compose.prod.yml logs caddy | tail -20
   ```
   Look for "configuration validated" or similar success message.

## Testing

### Desktop Browser Test
1. Open https://staging.bitcoindistrict.org in Chrome, Firefox, or Safari
2. Navigate to:
   - Book club page: `/bookclub` - verify book cover images load
   - Podcast page: `/podcast` - verify cover images and audio playback works
   - Events page: `/events` - verify event images load
3. Open browser DevTools → Network tab
4. Check that asset requests return 200 status codes
5. Verify CORS headers in response headers:
   - `Access-Control-Allow-Origin: https://staging.bitcoindistrict.org`

### iOS Safari Test
1. Open https://staging.bitcoindistrict.org on iPhone Safari
2. Test the same pages as above:
   - Book club page: book cover images should load
   - Podcast page: cover images and audio playback should work
   - Events page: event images should load
3. If using Safari Web Inspector (Mac connected to iPhone):
   - Check Network tab for asset requests
   - Verify no CORS errors in Console
   - Verify assets return 200 status codes

### Command Line Verification
Use the verification script to test CORS headers:

```bash
# Get an asset ID from Directus admin panel (File Library)
./scripts/verify-cors-headers.sh <asset-id>
```

Or test manually with curl:

```bash
# Test OPTIONS preflight
curl -X OPTIONS \
  -H "Origin: https://staging.bitcoindistrict.org" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Range" \
  -v https://admin.bitcoindistrict.org/assets/<asset-id>

# Test GET request
curl -I \
  -H "Origin: https://staging.bitcoindistrict.org" \
  https://admin.bitcoindistrict.org/assets/<asset-id>
```

Expected headers in response:
- `Access-Control-Allow-Origin: https://staging.bitcoindistrict.org`
- `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`
- `Access-Control-Allow-Headers: Range`
- `Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges`

## Troubleshooting

### Assets still not loading on iOS
1. **Clear browser cache** on iPhone: Settings → Safari → Clear History and Website Data
2. **Check Caddy logs** for errors:
   ```bash
   docker-compose -f docker-compose.prod.yml logs caddy | grep -i error
   ```
3. **Verify Caddyfile syntax**:
   ```bash
   docker-compose -f docker-compose.prod.yml exec caddy caddy validate --config /etc/caddy/Caddyfile
   ```
4. **Check Directus logs** for CSP violations:
   ```bash
   docker-compose -f docker-compose.prod.yml logs directus | grep -i "content-security-policy\|csp"
   ```

### CORS headers not present
1. Ensure Caddy container restarted successfully
2. Verify the `handle_path /assets*` block is before the main `handle` block in Caddyfile
3. Check that the origin matches exactly: `https://staging.bitcoindistrict.org` (no trailing slash)

### CSP still blocking assets
1. Verify `ASSETS_CONTENT_SECURITY_POLICY` is set in docker-compose.prod.yml
2. Restart Directus container to apply new environment variable
3. Check Directus environment variables:
   ```bash
   docker-compose -f docker-compose.prod.yml exec directus env | grep ASSETS_CONTENT_SECURITY_POLICY
   ```

## Files Modified
- `Caddyfile` - Added CORS headers for `/assets*` path
- `docker-compose.prod.yml` - Added `ASSETS_CONTENT_SECURITY_POLICY` environment variable
- `scripts/verify-cors-headers.sh` - Created verification script (new)
- `docs/ios-asset-loading-fix.md` - This documentation (new)
