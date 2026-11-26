export function resizeImage(file: File, max = 160): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const k = max / Math.max(img.width, img.height);
      c.width = Math.round(img.width * Math.min(1, k)); c.height = Math.round(img.height * Math.min(1, k));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    img.src = URL.createObjectURL(file);
  });
}
