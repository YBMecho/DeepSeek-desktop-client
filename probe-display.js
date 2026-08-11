const { app, screen } = require('electron');

app.whenReady().then(() => {
  const info = screen.getAllDisplays().map((d) => ({
    id: d.id,
    scaleFactor: d.scaleFactor,
    bounds: d.bounds,
    workArea: d.workArea
  }));
  console.log(JSON.stringify(info, null, 2));
  app.quit();
});