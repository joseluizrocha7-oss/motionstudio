# dotlottie-web 0.81.0

Player de Lottie do `M.lottie` (`runtime/motion.js`). Veio de `npm pack @lottiefiles/dotlottie-web@0.81.0` (publicado em 06/10/2026; licença MIT em `LICENSE`).

- `index.js`: o `dist/index.js` do pacote, sem mudança.
- `dotlottie-player.wasm.js`: o `dist/dotlottie-player.wasm` do pacote (1.238.072 bytes, sha256 `92822207905406eee4f0785e8d4a99a504a24db6f658abfaec074a9420471b25`) em gzip e base64. O `M.lottie` importa este módulo com `import()`, como o `index.js`, desfaz o gzip e entrega o `.wasm` ao player por um endereço `blob:` (escolha do projeto). Assim o `.wasm` chega pelo mesmo caminho do player, sem `fetch()` de `file://` e sem CDN. Em `file://`, o `import()` pede `--allow-file-access-from-files`, como o `fetch()`; o `render.mjs`, o `autoteste.mjs` e o `erros.mjs` abrem o Chrome com essa opção.
- `LICENSE`: a licença MIT da LottieFiles, a única que o pacote npm traz.
- `LICENCAS-TERCEIROS.md`: as licenças do código compilado dentro do `.wasm` (dotlottie-rs, ThorVG, libwebp, LodePNG, jpgd, RapidJSON, JerryScript, crates Rust), com a origem de cada texto (repositório e commit).

Para refazer o módulo do `.wasm`, rode na pasta onde o pacote foi aberto (`package/`):

```bash
node -e 'const fs=require("fs"),z=require("zlib");fs.writeFileSync("dotlottie-player.wasm.js","// dotlottie-player.wasm de @lottiefiles/dotlottie-web@0.81.0, em gzip e base64 (veja LEIA-ME.md).\nexport default \""+z.gzipSync(fs.readFileSync("dist/dotlottie-player.wasm"),{level:9}).toString("base64")+"\";\n")'
```
