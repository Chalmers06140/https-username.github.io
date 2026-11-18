import {defineConfig} from 'vite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root:path.join(root,'web'),
  base:'./',
  publicDir:path.join(root,'web/public'),
  build:{outDir:path.join(root,'docs'),emptyOutDir:true,rollupOptions:{input:{
    main:path.join(root,'web/index.html'),
    emergency:path.join(root,'web/emergency/index.html'),
    teacher:path.join(root,'web/teacher/index.html'),
    teacherTest:path.join(root,'web/teacher/test/index.html')
  }}}
});
