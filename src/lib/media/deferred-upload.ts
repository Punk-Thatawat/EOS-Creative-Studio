export type PendingImageUpload = {
  file: File;
  previewUrl: string;
};

export type PendingImageSlot =
  | "image-to-image"
  | "style-transfer-source"
  | "style-transfer-reference"
  | "background-source"
  | "background-reference"
  | "upscale-source"
  | "extend-source";
