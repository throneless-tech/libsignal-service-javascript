import { promises as fs } from 'fs';
import path from 'path';
import mime from 'mime-types';
import sizeOf from 'image-size';
import { v4 as getGuid } from 'uuid';
import { Attachment } from '../lib/ts/types/Attachment';

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

// eslint-disable-next-line no-unused-vars
//function isVideo(mimeType: string) {
//  return mimeType.startsWith('video/');
//}

// eslint-disable-next-line no-unused-vars
//function isAudio(mimeType: string) {
//  return mimeType.startsWith('audio/');
//}

function contentTypeToFileName(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/gif':
      return '.gif';
    case 'image/png':
      return '.png';
    case 'video/mp4':
      return '.mp4';
    case 'text/plain':
      return '.txt';
    default:
      return '.bin';
  }
}

// eslint-disable-next-line no-unused-vars
export async function loadFile(file: string) {
  const source = path.normalize(file);
  const fileName = path.basename(source);
  const contentType = mime.lookup(source);
  window.log.debug(`Reading file ${  source  } with MIME type ${  contentType}`);
  const buffer = await fs.readFile(source);
  let width: number; let height: number;
  if (contentType && isImage(contentType)) {
    const dimensions = sizeOf(source);
    width = dimensions.width;
    height = dimensions.height;
  }
  return {
    fileName,
    contentType,
    width,
    height,
    data: buffer.buffer,
    size: buffer.buffer.byteLength,
  };
}

export async function saveFile(file: Attachment, dest: string) {
  if (!file || !file.data || !file.contentType) {
    throw new Error('Invalid file.');
  }

  let {fileName} = file;
  if (!fileName) {
    const extension = contentTypeToFileName(file.contentType);
    const guid = getGuid();
    fileName = `${  guid  }${extension}`;
  }
  const target = path.join(dest, fileName);
  await fs.writeFile(target, Buffer.from(file.data));
  return target;
}
