import pytest

from pathlib import Path
from PIL import Image
import numpy as np

from slidie.ffmpeg import extract_video_frame, FrameExtractionError


class TestExtractVideoFrame:
    # NB: We run the test with times both within and outside the valid length
    # of the video and make sure we still get a frame
    @pytest.mark.parametrize("time", [0.0, 5.0, 100.0])
    def test_time_in_range(
        self, dummy_video: Path, tmp_path: Path, time: float
    ) -> None:
        out = tmp_path / "out.png"
        extract_video_frame(dummy_video, out, time)

        im = np.array(Image.open(out))

        # Is full size
        assert im.shape == (100, 200, 3)

        # Is blue
        assert np.all(np.isclose(im, (0, 0, 255), atol=5))

    def test_cwd(self, dummy_video: Path, tmp_path: Path) -> None:
        (tmp_path / "in.mp4").write_bytes(dummy_video.read_bytes())
        out = tmp_path / "out.png"
        extract_video_frame("in.mp4", out, cwd=tmp_path)

        # Check we still got an image out
        im = np.array(Image.open(out))
        assert im.shape == (100, 200, 3)

    def test_bad_input(self, tmp_path: Path) -> None:
        bad = tmp_path / "bad.mp4"
        bad.touch()
        out = tmp_path / "out.png"
        with pytest.raises(FrameExtractionError):
            extract_video_frame(bad, out)
