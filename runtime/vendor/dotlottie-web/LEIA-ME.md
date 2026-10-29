# dotlottie-web 0.81.0

Player de Lottie do `M.lottie` (`runtime/motion.js`). Veio de `npm pack @lottiefiles/dotlottie-web@0.81.0` (publicado em 06/10/2026; licença MIT em `LICENSE`).

- `index.js`: o `dist/index.js` do pacote, sem mudança.
- `dotlottie-player.wasm.js`: o `dist/dotlottie-player.wasm` do pacote (1.238.072 bytes, sha256 `92822207905406eee4f0785e8d4a99a504a24db6f658abfaec074a9420471b25`) em gzip e base64. O Chrome não deve buscar o `.wasm` por `fetch()` de `file://`: o `M.lottie` importa este módulo, desfaz o gzip e entrega o `.wasm` ao player por um endereço `blob:`.

Para refazer o módulo do `.wasm`, rode na pasta onde o pacote foi aberto (`package/`):

```bash
node -e 'const fs=require("fs"),z=require("zlib");fs.writeFileSync("dotlottie-player.wasm.js","// dotlottie-player.wasm de @lottiefiles/dotlottie-web@0.81.0, em gzip e base64 (veja LEIA-ME.md).\nexport default \""+z.gzipSync(fs.readFileSync("dist/dotlottie-player.wasm"),{level:9}).toString("base64")+"\";\n")'
```
