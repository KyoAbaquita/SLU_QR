document.addEventListener('DOMContentLoaded', async () => {
    await loadData();   // waits for MySQL data before rendering
    startScanner();

    // 🔄 RE-SYNC EVERY 5 SECONDS
    setInterval(syncRegistrations, 5000);
});
