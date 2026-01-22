import { defineConfig } from 'vite';
import fs from "fs";
import path from "path";

export default defineConfig({
  build: {
    minify: false,
    rollupOptions: {
      input: {
        visor: './index.html'
      },
      output: {
        entryFileNames: 'static/camview_lite_1.js',
        assetFileNames: 'static/camview_lite_1.css',
      }
    }
  },
  server: {
    port: 5003,
    proxy: {
      '/camview': {
        target: 'http://dustvisionai.meteodata.cl:8002',
        changeOrigin: true,
      },
      
      // "/camview/series": {
      //   target: "http://cualquiercosa.com",
      //   changeOrigin: true,
      //   bypass(req, res) {
      //     const filePath = path.resolve(__dirname, 'public/camview/series.json');
      //     const data = fs.readFileSync(filePath, 'utf-8');
      //     res.setHeader('Content-Type', 'application/json');
      //     res.end(data);
      //     return null;
      //   }
      // },
      '/media': {
        target: 'https://dustvisionai.meteodata.cl',
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {

            // // Servir archivo corrupto para chunk específico
            // if (req.url.includes('20251229_141000')) {
            //   console.log('Sirviendo archivo corrupto para:', req.url);
            //   proxyReq.destroy();
              
            //   const corruptedPath = path.resolve(__dirname, 'public/corrupted.mp4');
            //   const corruptedData = fs.readFileSync(corruptedPath);
              
            //   res.statusCode = 200;
            //   res.setHeader('Content-Type', 'video/mp4');
            //   res.setHeader('Content-Length', corruptedData.length);
            //   res.end(corruptedData);
            // }
            
            // // Simular fallo HTTP 500 para otro chunk
            // if (req.url.includes('20260120_225000.DustNet20250929.inp')) {
            //   console.log('Simulando fallo HTTP 500 para:', req.url);
            //   proxyReq.destroy();
            //   res.statusCode = 500;
            //   res.end('Simulated error');
            // }


          });
        }
      }
    },
  },
});