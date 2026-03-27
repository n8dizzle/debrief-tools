import { test, expect, Page } from '@playwright/test';

/**
 * Homework Onboarding Flow Test Agent
 * 
 * This test walks through the complete onboarding experience, capturing
 * screenshots and evaluating UI/UX at each step. It provides feedback
 * and suggestions for improving the "magic and delight" of the experience.
 */

interface UXObservation {
    step: string;
    category: 'positive' | 'improvement' | 'suggestion';
    message: string;
    screenshot?: string;
}

interface FlowMetrics {
    stepName: string;
    loadTime: number;
    animationsPresent: boolean;
    interactiveElementsCount: number;
}

const observations: UXObservation[] = [];
const metrics: FlowMetrics[] = [];

// Helper to capture screenshot with context
async function captureStep(page: Page, stepName: string, description: string) {
    const screenshotPath = `screenshots/${stepName}.png`;
    await page.screenshot({ path: `test-results/${screenshotPath}`, fullPage: true });
    console.log(`📸 ${stepName}: ${description}`);
    return screenshotPath;
}

// Helper to add UX observation
function observe(step: string, category: UXObservation['category'], message: string) {
    observations.push({ step, category, message });
    const icon = category === 'positive' ? '✅' : category === 'improvement' ? '⚠️' : '💡';
    console.log(`${icon} [${step}] ${message}`);
}

// Helper to count interactive elements
async function countInteractiveElements(page: Page): Promise<number> {
    return await page.locator('button, a, input, select, [role="button"]').count();
}

// Helper to check for animations
async function hasAnimations(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
        const animated = document.querySelectorAll('[class*="animate"], [class*="transition"]');
        return animated.length > 0;
    });
}

test.describe('Homework Onboarding Flow - UX Analysis', () => {

    test.beforeEach(async ({ page }) => {
        // Clear any existing state
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
    });

    test('Complete onboarding journey with UX evaluation', async ({ page }) => {
        const startTime = Date.now();

        // ========================================
        // STEP 1: Homepage First Impression
        // ========================================
        console.log('\n🏠 === STEP 1: HOMEPAGE FIRST IMPRESSION ===\n');

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const step1Start = Date.now();
        await captureStep(page, '01-homepage-hero', 'Initial homepage view with hero content');

        // Check for key hero elements
        const headline = await page.locator('h1').first().textContent();
        const tagline = await page.locator('text=Get prices, not quotes').isVisible();
        const promptTags = await page.locator('[class*="rounded-full"]').count();

        if (headline?.includes('Stop guessing')) {
            observe('homepage', 'positive', `Strong headline: "${headline}" - Creates immediate value proposition`);
        }

        if (tagline) {
            observe('homepage', 'positive', 'Clear differentiator: "Get prices, not quotes" - Sets expectation');
        }

        if (promptTags >= 4) {
            observe('homepage', 'positive', `${promptTags} quick-action tags available - Reduces friction for common needs`);
        }

        // Check animations
        const hasEntryAnimations = await hasAnimations(page);
        if (hasEntryAnimations) {
            observe('homepage', 'positive', 'Entry animations present - Creates polished first impression');
        } else {
            observe('homepage', 'suggestion', 'Consider adding subtle entry animations for elements');
        }

        // Check badge visibility
        const badge = await page.locator('text=The New Standard').isVisible();
        if (badge) {
            observe('homepage', 'positive', 'Brand badge visible - Establishes positioning');
        }

        metrics.push({
            stepName: 'Homepage',
            loadTime: Date.now() - step1Start,
            animationsPresent: hasEntryAnimations,
            interactiveElementsCount: await countInteractiveElements(page),
        });

        // ========================================
        // STEP 2: Intent Selection
        // ========================================
        console.log('\n🎯 === STEP 2: INTENT SELECTION ===\n');

        await captureStep(page, '02-prompt-tags', 'Quick action prompt tags');

        // Click on "New HVAC pricing" tag
        const hvacTag = page.locator('text=New HVAC pricing').first();
        if (await hvacTag.isVisible()) {
            await hvacTag.click();
            observe('intent', 'positive', 'Prompt tags are clickable and responsive');

            await page.waitForTimeout(500);
            await captureStep(page, '03-after-intent-click', 'After clicking HVAC pricing tag');
        }

        // ========================================
        // STEP 3: Chat Interface & Address Entry
        // ========================================
        console.log('\n💬 === STEP 3: CHAT INTERFACE ===\n');

        // Wait for chat response
        await page.waitForTimeout(2000);

        const chatContainer = page.locator('[class*="overflow-y-auto"]').first();
        if (await chatContainer.isVisible()) {
            observe('chat', 'positive', 'Chat interface appears smoothly after intent selection');
            await captureStep(page, '04-chat-interface', 'Chat interface with AI response');
        }

        // Check for typing indicator
        const typingIndicator = await page.locator('[class*="animate-spin"]').isVisible();
        if (typingIndicator) {
            observe('chat', 'positive', 'Loading/typing indicator shows system is working');
        }

        // Wait for address input to appear
        await page.waitForTimeout(2000);
        await captureStep(page, '05-address-input', 'Address input field appears');

        // Look for address input
        const addressInput = page.locator('input[placeholder*="address"], input[placeholder*="Enter your"]').first();
        if (await addressInput.isVisible()) {
            observe('address', 'positive', 'Address input is clearly visible with helpful placeholder');

            // Type a test address
            await addressInput.fill('1600 Pennsylvania Ave');
            await page.waitForTimeout(1000);
            await captureStep(page, '06-address-autocomplete', 'Address autocomplete suggestions');

            // Check for autocomplete suggestions
            const suggestions = page.locator('[class*="prediction"], [class*="suggestion"]');
            if (await suggestions.first().isVisible()) {
                observe('address', 'positive', 'Address autocomplete provides helpful suggestions');
                observe('address', 'suggestion', 'Consider showing house icon or map pin next to suggestions for visual clarity');
            }
        } else {
            observe('address', 'improvement', 'Address input may need more prominent styling or earlier appearance');
        }

        // ========================================
        // STEP 4: Loading Experience
        // ========================================
        console.log('\n⏳ === STEP 4: LOADING EXPERIENCE ===\n');

        // Try to select an address and trigger loading
        // For demo, we'll use a mock flow - in real test, select from autocomplete
        const mockAddressFlow = async () => {
            // Type full address
            const addrInput = page.locator('input[placeholder*="address"], input[placeholder*="Enter"]').first();
            if (await addrInput.isVisible()) {
                await addrInput.clear();
                await addrInput.fill('123 Main St, Dallas, TX');
                await page.waitForTimeout(1500);

                // Try to click a suggestion
                const suggestion = page.locator('text=Dallas').first();
                if (await suggestion.isVisible()) {
                    await suggestion.click();
                    await page.waitForTimeout(500);
                }
            }
        };

        await mockAddressFlow();
        await captureStep(page, '07-loading-start', 'Loading experience begins');

        // Check for loading messages
        await page.waitForTimeout(3000);
        const loadingChecks = page.locator('text=Found it, text=Pulling property, text=Tax records, text=satellite imagery, text=HomeFit');
        const loadingSteps = await loadingChecks.count();

        if (loadingSteps > 0) {
            observe('loading', 'positive', 'Progressive loading messages educate user about what\'s happening');
            observe('loading', 'positive', 'Loading experience feels purposeful, not just waiting');
        }

        await captureStep(page, '08-loading-progress', 'Loading with progress indicators');

        // Check for fun fact
        await page.waitForTimeout(3000);
        const funFact = await page.locator('text=Did you know').isVisible();
        if (funFact) {
            observe('loading', 'positive', '"Did you know" fact adds delight and education during wait');
        }

        await captureStep(page, '09-loading-complete', 'Loading complete with property info');

        // ========================================
        // STEP 5: Auth Prompt (if shown)
        // ========================================
        console.log('\n🔐 === STEP 5: AUTH CHECK ===\n');

        await page.waitForTimeout(2000);
        const authPrompt = await page.locator('text=Continue with Google').isVisible();
        if (authPrompt) {
            observe('auth', 'positive', 'Auth prompt is clear with social login option');
            await captureStep(page, '10-auth-prompt', 'Authentication options');

            // Check for email option
            const emailOption = await page.locator('text=Continue with email').isVisible();
            if (emailOption) {
                observe('auth', 'positive', 'Email alternative provided for users without Google');
            }
        }

        // ========================================
        // Generate Summary Report
        // ========================================
        console.log('\n\n📊 ========================================');
        console.log('    ONBOARDING FLOW UX ANALYSIS REPORT');
        console.log('========================================\n');

        console.log('📈 METRICS:');
        console.log('─────────────────────────────────────────');
        metrics.forEach(m => {
            console.log(`  ${m.stepName}:`);
            console.log(`    • Load time: ${m.loadTime}ms`);
            console.log(`    • Animations: ${m.animationsPresent ? 'Yes' : 'No'}`);
            console.log(`    • Interactive elements: ${m.interactiveElementsCount}`);
        });

        console.log('\n✅ POSITIVES:');
        console.log('─────────────────────────────────────────');
        observations
            .filter(o => o.category === 'positive')
            .forEach(o => console.log(`  • [${o.step}] ${o.message}`));

        console.log('\n⚠️  IMPROVEMENTS NEEDED:');
        console.log('─────────────────────────────────────────');
        const improvements = observations.filter(o => o.category === 'improvement');
        if (improvements.length === 0) {
            console.log('  • No critical improvements identified');
        } else {
            improvements.forEach(o => console.log(`  • [${o.step}] ${o.message}`));
        }

        console.log('\n💡 SUGGESTIONS:');
        console.log('─────────────────────────────────────────');
        observations
            .filter(o => o.category === 'suggestion')
            .forEach(o => console.log(`  • [${o.step}] ${o.message}`));

        // Additional suggestions based on best practices
        console.log('\n📝 ADDITIONAL RECOMMENDATIONS:');
        console.log('─────────────────────────────────────────');
        console.log('  1. 🎨 Visual Hierarchy');
        console.log('     • Ensure primary CTA has 3:1 contrast ratio minimum');
        console.log('     • Consider adding micro-animations on hover for prompt tags');
        console.log('');
        console.log('  2. 📱 Mobile Experience');
        console.log('     • Test thumb-reach zones for bottom actions');
        console.log('     • Ensure keyboard doesn\'t obscure address input');
        console.log('');
        console.log('  3. ⚡ Performance');
        console.log('     • Consider skeleton loaders for chat messages');
        console.log('     • Preload next step assets during loading animation');
        console.log('');
        console.log('  4. 🎯 Conversion');
        console.log('     • Add progress indicator showing "Step X of Y"');
        console.log('     • Consider exit-intent save for incomplete flows');
        console.log('');
        console.log('  5. 🌟 Delight Factors');
        console.log('     • Add subtle confetti/celebration on address confirmation');
        console.log('     • Personalize fun facts based on actual home data');
        console.log('     • Consider sound design for key moments (optional toggle)');

        const totalTime = Date.now() - startTime;
        console.log(`\n⏱️  Total test duration: ${(totalTime / 1000).toFixed(2)}s`);
        console.log('\n========================================\n');
    });

    test('Mobile viewport responsiveness', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        console.log('\n📱 === MOBILE RESPONSIVENESS TEST ===\n');

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await captureStep(page, 'mobile-01-homepage', 'Mobile homepage view');

        // Check hero text sizing
        const h1 = page.locator('h1').first();
        const h1Box = await h1.boundingBox();
        if (h1Box && h1Box.width <= 375) {
            observe('mobile', 'positive', 'Hero headline fits within mobile viewport');
        }

        // Check button sizing for touch
        const buttons = page.locator('button');
        const buttonCount = await buttons.count();
        let smallButtons = 0;

        for (let i = 0; i < Math.min(buttonCount, 5); i++) {
            const box = await buttons.nth(i).boundingBox();
            if (box && (box.height < 44 || box.width < 44)) {
                smallButtons++;
            }
        }

        if (smallButtons > 0) {
            observe('mobile', 'improvement', `${smallButtons} buttons may be too small for comfortable touch (< 44px)`);
        } else {
            observe('mobile', 'positive', 'All visible buttons meet touch target guidelines');
        }

        // Check horizontal overflow
        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        if (hasHorizontalScroll) {
            observe('mobile', 'improvement', 'Horizontal scroll detected - content may overflow');
        } else {
            observe('mobile', 'positive', 'No horizontal overflow - proper responsive layout');
        }

        await captureStep(page, 'mobile-02-scroll', 'Mobile scroll view');

        console.log('\n📱 Mobile Test Summary:');
        observations
            .filter(o => o.step.includes('mobile'))
            .forEach(o => {
                const icon = o.category === 'positive' ? '✅' : '⚠️';
                console.log(`  ${icon} ${o.message}`);
            });
    });

    test.afterAll(async () => {
        // Final summary output
        console.log('\n\n🎉 All onboarding flow tests completed!');
        console.log('📁 Screenshots saved to: test-results/screenshots/');
        console.log('📊 HTML report available: npx playwright show-report\n');
    });
});
