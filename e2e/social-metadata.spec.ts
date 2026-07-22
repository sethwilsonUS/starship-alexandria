import { expect, test } from './fixtures';

const PRODUCTION_URL = 'https://starship-alexandria.vercel.app';
const SOCIAL_IMAGE_URL = `${PRODUCTION_URL}/images/og.png`;
const SOCIAL_IMAGE_ALT =
  'Starship Alexandria hovers above a moonlit Arcadian city of temples and a ruined cathedral while a lone archivist stands in a blue transporter beam.';

test('@smoke publishes complete social-sharing metadata', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', PRODUCTION_URL);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', PRODUCTION_URL);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    SOCIAL_IMAGE_URL,
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    'content',
    SOCIAL_IMAGE_ALT,
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    'content',
    SOCIAL_IMAGE_URL,
  );
  await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
    'content',
    SOCIAL_IMAGE_ALT,
  );
});
