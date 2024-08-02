import fs from 'fs';

const GCODE_FILE_PATH = 'server/gcode/default-gcode.gcode';

// read .gcode file into string
export function readGCodeFile(file_path) {
  return new Promise((resolve, reject) => {
    fs.readFile(file_path, 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}

export function GCodeProvider(file_path) {
  if (!file_path) {
    file_path = GCODE_FILE_PATH;
  }
  return readGCodeFile(file_path);
}