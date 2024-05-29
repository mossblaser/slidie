import pytest

from typing import Any, Iterator

from pathlib import Path
from tempfile import TemporaryDirectory
from contextlib import contextmanager
import io
import time

from PIL import Image
import numpy as np
from numpy.typing import NDArray

from svgs import get_svg_filename

from selenium import webdriver
from selenium.webdriver import Keys, ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support.expected_conditions import element_to_be_clickable
from selenium.common.exceptions import NoSuchDriverException
from selenium.webdriver import Remote as WebDriver
from selenium.webdriver.remote.webelement import WebElement

from slidie.render_xhtml import render_xhtml


@pytest.fixture(scope="module")
def viewer_path() -> Iterator[Path]:
    """Path to a rendered viewer application."""
    with TemporaryDirectory() as tmp_path_str:
        tmp_path = Path(tmp_path_str)

        for i, slide in enumerate(
            [
                "empty.svg",
                "build_rgb.svg",
                "negative_build_step_number.svg",
                "iframes.svg",
                "video.svg",
            ]
        ):
            slide_name = tmp_path / f"{i}.svg"
            slide_name.write_bytes(get_svg_filename(slide).read_bytes())

        out_filename = tmp_path / "out.xhtml"
        render_xhtml(tmp_path, out_filename)

        yield out_filename


# XXX: No cross platform webkit browser supported...
@pytest.fixture(scope="module", params=["chrome", "firefox"])
def browser(request: Any) -> str:
    """
    Parametrized fixture defining the browser to test with.
    """
    return request.param


@pytest.fixture(scope="module")
def driver(browser: str, request: Any) -> Iterator[WebDriver]:
    """An single instance of each browser driver."""
    headless = not request.config.getoption("no_headless_browser")
    try:
        match browser:
            case "chrome":
                chrome_options = webdriver.ChromeOptions()
                if headless:
                    chrome_options.add_argument("--headless=new")
                with webdriver.Chrome(options=chrome_options) as driver:
                    yield driver
            case "firefox":
                firefox_options = webdriver.FirefoxOptions()
                if headless:
                    firefox_options.add_argument("-headless")
                with webdriver.Firefox(options=firefox_options) as driver:
                    yield driver
            case _:
                raise NotImplementedError(browser)
    except NoSuchDriverException:
        pytest.skip(f"{browser} not found by selenium")


@pytest.fixture
def viewer(request: Any, driver: WebDriver, viewer_path: Path) -> WebDriver:
    """A freshly opened viewer (per test)."""
    driver.get(viewer_path.as_uri())
    return driver


def viewer_screenshot(viewer: WebDriver) -> NDArray:
    return np.array(Image.open(io.BytesIO(viewer.get_screenshot_as_png())))


def viewer_fullscreen(viewer: WebDriver) -> None:
    """Make the viewer full screen."""
    button = viewer.find_element(By.ID, "full-screen")
    button.click()


@contextmanager
def wait_for_url_change(viewer: WebDriver, timeout: float = 1) -> Iterator[None]:
    """
    Context manager which, on exit, waits for the URL to change from whatever
    it was when the context was entered.
    """
    old_url = viewer.current_url
    yield
    WebDriverWait(viewer, timeout).until(lambda viewer: viewer.current_url != old_url)


def viewer_next_step(viewer: WebDriver) -> None:
    """
    Advance to the next step using the keyboard.
    """
    with wait_for_url_change(viewer):
        ActionChains(viewer).send_keys(Keys.DOWN).perform()


def viewer_go_to_step(viewer: WebDriver, step: str) -> None:
    slide_number_input = viewer.find_element(
        By.CSS_SELECTOR, "#slide-selector .slide-number"
    )
    if slide_number_input.get_attribute("value") != step:
        with wait_for_url_change(viewer):
            # XXX: Workaround for chrome webdriver bug which fails to
            # select-on-focus when XHTML namespace is the default namespace.
            # (Yep.)
            slide_number_input.send_keys(Keys.BACKSPACE * 100)
            slide_number_input.send_keys(step + Keys.ENTER)


def viewer_current_svg(viewer: WebDriver) -> WebElement:
    """
    Get the <svg> element of the currently displayed slide (inside its shadow
    DOM)
    """
    containers = viewer.find_elements(By.CSS_SELECTOR, "#slides .slide-container")
    (current_slide_container,) = [c for c in containers if c.is_displayed()]
    current_slide = current_slide_container.shadow_root.find_element(
        By.CSS_SELECTOR, "svg"
    )
    return current_slide


def viewer_svg_click(viewer: WebDriver, element: WebElement) -> None:
    """
    Emulate a 'click' on an SVG element. Only required due to Firefox not
    supporting `.click()` on SVG elements.
    """
    viewer.execute_script('arguments[0].dispatchEvent(new Event("click"))', element)


def colour_bbox(im: NDArray, r: int, g: int, b: int) -> tuple[int, int, int, int]:
    """
    Returns the (x, y, width, height) of the bbox of all pixels of the
    specified colour in a (height, width, 4) image array.
    """
    matching_colours = np.all(im == [r, g, b, 255], axis=-1)
    coords = np.argwhere(matching_colours)

    y, x = np.min(coords, axis=0)
    y2, x2 = np.max(coords, axis=0)

    return (x, y, x2 - x, y2 - y)


class TestViewer:
    def test_basic_slide_display(self, viewer: WebDriver) -> None:
        # Visually verify that slides and steps are displayed and stepped

        viewer_fullscreen(viewer)

        for exp_colour in [
            (255, 255, 255),  # empty.svg
            (255, 0, 0),  # build_rgb.svg#1
            (0, 255, 0),  # build_rgb.svg#2
            (0, 0, 255),  # build_rgb.svg#3
        ]:
            # Grab central pixel
            im = viewer_screenshot(viewer)
            h, w, _ = im.shape
            colour = tuple(im[h // 2, w // 2][:3])

            assert colour == exp_colour

            viewer_next_step(viewer)

    def test_custom_hash(self, viewer: WebDriver) -> None:
        # Check non-default URL hashes are reflected in the UI and visa-versa

        slide_number_input = viewer.find_element(
            By.CSS_SELECTOR, "#slide-selector .slide-number"
        )

        # Test UI -> URL hash
        with wait_for_url_change(viewer):
            # XXX: Workaround for chrome webdriver bug which fails to
            # select-on-focus when XHTML namespace is the default namespace.
            # (Yep.)
            slide_number_input.send_keys(Keys.BACKSPACE * 100)
            slide_number_input.send_keys("negative_build_step_number#1" + Keys.ENTER)
        base_url, _, url_hash = viewer.current_url.partition("#")
        assert url_hash == "negative_build_step_number#1"

        # Test URL hash -> UI
        viewer.get(base_url + "#negative_build_step_number@foo")
        assert (
            slide_number_input.get_attribute("value")
            == "negative_build_step_number@foo"
        )

    def test_foreign_element_scaling(self, viewer: WebDriver) -> None:
        viewer_go_to_step(viewer, "iframes")
        viewer_fullscreen(viewer)
        im = viewer_screenshot(viewer)

        sx, sy, sw, sh = colour_bbox(im, 255, 255, 255)
        ss = 1920 / sw  # Scale factor

        # Sanity check: slide has correct aspect ratio
        assert sw * ss == pytest.approx(1920, abs=10)
        assert sh * ss == pytest.approx(1080, abs=10)

        # Check iframes shown at expected sizes
        f1x, f1y, f1w, f1h = colour_bbox(im, 255, 0, 0)
        assert f1w * ss == pytest.approx(700, abs=10)
        assert f1h * ss == pytest.approx(600, abs=10)

        f2x, f2y, f2w, f2h = colour_bbox(im, 0, 255, 0)
        assert f2w * ss == pytest.approx(700, abs=10)
        assert f2h * ss == pytest.approx(600, abs=10)

        # Check scale=1 iframe's inner box has correct scaling and positioning
        b1x, b1y, b1w, b1h = colour_bbox(im, 0, 255, 255)
        assert (b1x - f1x) * ss == pytest.approx(100, abs=10)
        assert (b1y - f1y) * ss == pytest.approx(50, abs=10)
        assert b1w * ss == pytest.approx(100, abs=10)
        assert b1h * ss == pytest.approx(50, abs=10)

        # Check scale=2 iframe's inner box has correct scaling and positioning
        b2x, b2y, b2w, b2h = colour_bbox(im, 255, 0, 255)
        assert (b2x - f2x) * ss / 2 == pytest.approx(100, abs=10)
        assert (b2y - f2y) * ss / 2 == pytest.approx(50, abs=10)
        assert b2w * ss / 2 == pytest.approx(100, abs=10)
        assert b2h * ss / 2 == pytest.approx(50, abs=10)

    def test_iframe_link_target(self, viewer: WebDriver) -> None:
        viewer_go_to_step(viewer, "iframes")
        viewer_fullscreen(viewer)

        # Find the (initially green) iframe
        im = viewer_screenshot(viewer)
        gx, gy, gw, gh = colour_bbox(im, 0, 255, 0)

        # Click the link
        link = viewer_current_svg(viewer).find_element(By.ID, "go-blue")
        viewer_svg_click(viewer, link)

        # Check our iframe has gone blue
        im = viewer_screenshot(viewer)
        bx, by, bw, bh = colour_bbox(im, 0, 0, 255)
        assert (gx, gy, gw, gh) == pytest.approx((bx, by, bw, bh), abs=10)

    def test_video_pause_and_restart(self, viewer: WebDriver) -> None:
        viewer_go_to_step(viewer, "video")
        time.sleep(0.3)

        # Capture within first second
        im1 = viewer_screenshot(viewer)

        # Capture next second (vide only changes once per second)
        time.sleep(1.1)
        im2 = viewer_screenshot(viewer)

        # Check video is playing
        assert not np.array_equal(im1, im2)

        # Check switching slides takes us back to first frame
        viewer_go_to_step(viewer, "iframes")
        viewer_go_to_step(viewer, "video")
        time.sleep(0.3)
        im3 = viewer_screenshot(viewer)

        assert np.array_equal(im1, im3)

        # Capture next second (vide only changes once per second)
        time.sleep(1.1)
        im4 = viewer_screenshot(viewer)

        # Check video is playing
        assert not np.array_equal(im3, im4)
