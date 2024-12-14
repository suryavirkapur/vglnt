import yt_dlp
import os
from typing import Optional


def download_driving_pov(url: str, output_dir: Optional[str] = "driving_povs") -> None:
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": os.path.join(output_dir, "%(title)s.%(ext)s"),
        "quiet": False,
        "no_warnings": False,
        "extract_flat": False,
        "postprocessors": [
            {
                "key": "FFmpegVideoConvertor",
                "preferedformat": "mp4",
            }
        ],
        # Progress hooks for download status
        "progress_hooks": [show_progress],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Downloading video from: {url}")
            ydl.download([url])
            print(f"\nDownload completed! Video saved in: {output_dir}")
    except Exception as e:
        print(f"An error occurred: {str(e)}")


def show_progress(d: dict) -> None:
    if d["status"] == "downloading":
        percentage = d.get("_percent_str", "N/A")
        speed = d.get("_speed_str", "N/A")
        eta = d.get("_eta_str", "N/A")
        print(f"\rProgress: {percentage} | Speed: {speed} | ETA: {eta}", end="")
    elif d["status"] == "finished":
        print("\nDownload finished, now converting...")


if __name__ == "__main__":
    print("Driving POV Video Downloader")
    print("-" * 30)

    while True:
        url = input("\nEnter video URL (or 'q' to quit): ").strip()

        if url.lower() == "q":
            break

        output_dir = "../../data/driving_povs"

        download_driving_pov(url, output_dir)
