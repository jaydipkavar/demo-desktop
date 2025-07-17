import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { platform } from "os";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import express from "express";
import os from "os";
let win;
let server;

const isDev = !app.isPackaged;

function createWindow() {
    const __dirname = dirname(fileURLToPath(import.meta.url));

    if (!isDev) {
        // Create express server for production
        const serverApp = express();
        const port = 3000;

        // Serve static files from dist directory
        serverApp.use(express.static(path.join(__dirname, "../dist")));

        // Handle React Router (fallback to index.html for SPA)
        serverApp.get("/", (req, res) => {
            res.sendFile(path.join(__dirname, "../dist/index.html"));
        });

        // Catch all other routes and serve index.html
        serverApp.use((req, res) => {
            res.sendFile(path.join(__dirname, "../dist/index.html"));
        });

        server = serverApp
            .listen(port, (err) => {
                if (err) {
                    console.error("Failed to start server:", err);
                    // Fallback to file loading if server fails
                    createBrowserWindow(
                        __dirname,
                        `file://${path.join(__dirname, "../dist/index.html")}`
                    );
                    return;
                }
                console.log(`Server running on http://localhost:${port}`);
                createBrowserWindow(__dirname, `http://localhost:${port}`);
            })
            .on("error", (err) => {
                console.error("Server error:", err);
                // Fallback to file loading if server fails
                createBrowserWindow(
                    __dirname,
                    `file://${path.join(__dirname, "../dist/index.html")}`
                );
            });
    } else {
        createBrowserWindow(__dirname, "http://localhost:5173");
    }
}

function createBrowserWindow(__dirname, loadUrl) {
    win = new BrowserWindow({
        menu: null,
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            partition: "persist:main", 
            experimentalFeatures: true, // Enable experimental web features
        },
        icon: path.join(__dirname, "../assets/icon.png"),
        title: "AgentAct",
    });

    // Hide the menu bar in production
    if (!isDev) {
        win.setMenuBarVisibility(false);
        win.removeMenu();

        if (platform() === "darwin") {
            Menu.setApplicationMenu(Menu.buildFromTemplate([]));
        }
        // win.webContents.openDevTools(); // Remove this line when you're done testing
    }

    // Load the URL (either dev server or local express server)
    win.loadURL(loadUrl);
}

let playwrightBrowser, page, currentUrl;

// Handle Playwright playwrightBrowser launch
// Simple alternative approach for browser launch


ipcMain.handle("launch-playwright", async (_event, url) => {
    try {
        const platform = os.platform();
        const isWindows = platform === "win32";
        const isLinux = platform === "linux";
        const isMac = platform === "darwin";

        let launchOptions = {
            headless: false,
            slowMo: 50,
        };

        // Configure launch options based on platform
        if (isWindows) {
            // Windows-specific configuration
            launchOptions.args = [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ];

            // For production on Windows, use system Chrome or bundled version
            if (!isDev) {
                // Option 1: Try to use system Chrome first
                try {
                    launchOptions.channel = "chrome";
                } catch (error) {
                    // Option 2: Use bundled browsers with environment variable
                    process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
                        process.resourcesPath,
                        "playwright-browsers"
                    );

                    console.log(
                        "Using default Playwright browser resolution for Windows"
                    );
                }
            }
        } else if (isLinux) {
            // Linux-specific configuration
            launchOptions.width = 1106;
            launchOptions.height = 857;
        } else if (isMac) {
            // macOS-specific configuration
            launchOptions.args = ["--no-sandbox", "--disable-setuid-sandbox"];

            // For production on macOS, try to use system Chrome
            if (!isDev) {
                try {
                    launchOptions.channel = "chrome";
                } catch (error) {
                    // Fallback to bundled browsers
                    process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
                        process.resourcesPath,
                        "playwright-browsers"
                    );

                    console.log(
                        "Using default Playwright browser resolution for macOS"
                    );
                }
            }
        } else {
            // Other platforms - use basic configuration
            launchOptions.args = ["--no-sandbox", "--disable-setuid-sandbox"];
        }

        console.log(`Platform: ${platform}`);
        console.log("Launch options:", launchOptions);

        if (!playwrightBrowser) {
            console.log("Launching Playwright browser...");

            // Try multiple approaches for Windows and macOS, simple approach for Linux
            if (isWindows || isMac) {
                try {
                    playwrightBrowser = await chromium.launch(launchOptions);
                } catch (error) {
                    console.log(
                        "First launch attempt failed, trying fallback..."
                    );

                    // Fallback: remove channel and try again
                    delete launchOptions.channel;
                    playwrightBrowser = await chromium.launch(launchOptions);
                }
            } else {
                // Linux and other platforms - direct launch
                playwrightBrowser = await chromium.launch(launchOptions);
            }

            if (!page) {
                page = await playwrightBrowser.newPage();

                // Set viewport size based on platform
                if (isWindows || isMac) {
                    await page.setViewportSize({ width: 1106, height: 857 });
                }
                // For Linux, viewport size is handled in launch options
            }
        }

        if (currentUrl !== url) {
            console.log(`Navigating to: ${url}`);

            // Use different navigation options based on platform
            if (isWindows || isMac) {
                await page.goto(url, {
                    waitUntil: "networkidle",
                    timeout: 30000,
                });
            } else {
                // Linux - simpler navigation
                await page.goto(url);
            }
            currentUrl = url;
        }

        return {
            success: true,
            message: `Playwright browser launched successfully on ${platform}!`,
        };
    } catch (error) {
        console.error("Error launching Playwright:", error);

        // Clean up on error
        if (playwrightBrowser) {
            try {
                await playwrightBrowser.close();
            } catch (closeError) {
                console.error("Error closing browser:", closeError);
            }
            playwrightBrowser = null;
            page = null;
            currentUrl = null;
        }

        return {
            success: false,
            message: `Failed to launch browser on ${os.platform()}: ${
                error.message
            }`,
        };
    }
});

ipcMain.handle("capture-screenshot", async () => {
    if (page) {
        const screenshotBuffer = await page.screenshot({ type: "png" });
        console.log(screenshotBuffer);
        return screenshotBuffer.toString("base64");
    }
    return null;
});
// Handle fetching page content using Playwright
// @ts-ignore
ipcMain.handle("getPageContent", async (event) => {
    if (!page) throw new Error("Page not initialized");
    const width = await page.evaluate(
        () => document.documentElement.scrollWidth
    );
    const height = await page.evaluate(
        () => document.documentElement.scrollHeight
    );
    return { content: await page.content(), width, height };
});
ipcMain.handle("waitForPage", async () => {
    try {
        if (!page) return { success: false, message: "Page not initialized" };

        await page.waitForTimeout(2000);
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
        await page.waitForLoadState("load", { timeout: 10000 });
        await page.waitForLoadState("networkidle", { timeout: 10000 });

        return { success: true };
    } catch (err) {
        return { success: false, message: err.message };
    }
});
// @ts-ignore
ipcMain.handle("performAction", async (event, actionObj) => {
    // actionObj: { action, final_xpath, keyboard_input }
    if (actionObj.final_xpath) {
        const elements = await page
            .locator(actionObj.final_xpath)
            .elementHandles();

        // @ts-ignore
        let ele1 = null;
        for (const ele of elements) {
            if ((await ele.isVisible()) && (await ele.isEnabled())) {
                const box = await ele.boundingBox();
                const screenshotBuffer = await page.screenshot({ type: "png" });
                if (actionObj.action === "click") {
                    await ele.click();
                } else if (actionObj.action === "typed") {
                    await ele.fill("");
                    await ele.type(actionObj.keyboard_input, { delay: 50 });
                }
                return {
                    success: true,
                    img: screenshotBuffer.toString("base64"),
                    message: `Action '${actionObj.action}' performed`,
                    elementInfo: { box },
                };
                // @ts-ignore
                break;
            }
        }
    }
    const screenshotBuffer = await page.screenshot({ type: "png" });
    return {
        success: false,
        message: "No visible and enabled element found for given XPath",
        elementInfo: null,
        img: screenshotBuffer.toString("base64"),
    };
});

// Handle closing Playwright browser
ipcMain.handle("close-playwright", async () => {
    try {
        if (playwrightBrowser) {
            await playwrightBrowser.close();
            playwrightBrowser = null;
            currentUrl = null;
            page = null;
            return { success: true, message: "Playwright browser closed" };
        }
        return { success: false, message: "No browser to close" };
    } catch (error) {
        console.error("Error closing Playwright:", error);
        return { success: false, message: error.message };
    }
});

app.setName("AgentAct");
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        // Close the express server when app quits
        if (server) {
            server.close();
        }
        app.quit();
    }
});

app.on("before-quit", () => {
    if (server) {
        server.close();
    }
});

ipcMain.on("ping", (event, arg) => {
    event.reply("pong", "Pong received: " + arg);
});

ipcMain.handle("api-fetch", async (_event, url, options) => {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return { ok: true, data };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});
