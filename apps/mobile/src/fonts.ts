/** Mark the document once web fonts settle so text textures in the 3D scene redraw with the right face. */
export function watchFontsReady() {
  try {
    (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(() => document.documentElement.classList.add('fonts-ready'));
  } catch {
    /* fonts are a nicety */
  }
}
