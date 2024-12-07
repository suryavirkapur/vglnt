import * as fs from "fs";
import * as path from "path";
import ffmpeg from "fluent-ffmpeg";

export class VideoProcessor {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), "temp_frames");
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir);
    }
  }

  async extractFrames(
    videoPath: string,
    frameInterval: number = 1
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const frameFiles: string[] = [];

      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const duration = metadata.format.duration || 0;
        const frameCount = Math.floor(duration / frameInterval);

        ffmpeg(videoPath)
          .on("filenames", (filenames) => {
            frameFiles.push(
              ...filenames.map((f) => path.join(this.tempDir, f))
            );
          })
          .on("end", () => {
            // Verify all files exist before resolving
            const existingFiles = frameFiles.filter((file) =>
              fs.existsSync(file)
            );
            resolve(existingFiles);
          })
          .on("error", (err) => reject(err))
          .screenshots({
            count: frameCount,
            filename: "frame-%d.jpg",
            folder: this.tempDir,
            size: "640x360",
            timemarks: Array.from(
              { length: frameCount },
              (_, i) => i * frameInterval
            ),
          });
      });
    });
  }

  async processFrames(frameFiles: string[]): Promise<string[]> {
    const processedFiles: string[] = [];

    for (let index = 0; index < frameFiles.length; index++) {
      const frameFile = frameFiles[index];
      try {
        // Verify source file exists
        if (!fs.existsSync(frameFile)) {
          console.warn(`Skipping missing frame: ${frameFile}`);
          continue;
        }

        const processedFrameFile = path.join(
          this.tempDir,
          `processed-${index}.jpg`
        );

        // Use copyFile instead of rename to avoid issues with files being in use
        await fs.promises.copyFile(frameFile, processedFrameFile);
        processedFiles.push(processedFrameFile);

        // Optional: Remove original frame after successful copy
        try {
          await fs.promises.unlink(frameFile);
        } catch (error) {
          console.warn(`Could not remove original frame ${frameFile}:`, error);
        }
      } catch (error) {
        console.error(`Error processing frame ${frameFile}:`, error);
      }
    }

    return processedFiles;
  }

  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = await fs.promises.readdir(this.tempDir);
        await Promise.all(
          files.map((file) =>
            fs.promises
              .unlink(path.join(this.tempDir, file))
              .catch((error) =>
                console.warn(`Failed to delete ${file}:`, error)
              )
          )
        );
        await fs.promises.rmdir(this.tempDir);
      }
    } catch (error) {
      console.error("Error cleaning up temporary files:", error);
    }
  }

  async getVideoMetadata(videoPath: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });
  }
}

async function main() {
  const videoProcessor = new VideoProcessor();

  try {
    const inputVideoPath = "./input.mp4";

    // Verify input video exists
    if (!fs.existsSync(inputVideoPath)) {
      throw new Error(`Input video not found: ${inputVideoPath}`);
    }

    // Get video metadata
    const metadata = await videoProcessor.getVideoMetadata(inputVideoPath);
    console.log(`Video duration: ${metadata.format.duration} seconds`);

    // Extract frames
    console.log("Extracting frames...");
    const frameFiles = await videoProcessor.extractFrames(inputVideoPath, 1);
    console.log(`Extracted ${frameFiles.length} frames`);

    // Process frames
    console.log("Processing frames...");
    const processedFrameFiles = await videoProcessor.processFrames(frameFiles);
    console.log(`Successfully processed ${processedFrameFiles.length} frames`);
  } catch (error) {
    console.error("Error processing video:", error);
  } finally {
    // Cleanup temporary files
    //await videoProcessor.cleanup();
  }
}
