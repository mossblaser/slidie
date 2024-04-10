import pytest

from typing import Any, Iterator

from pathlib import Path
from tempfile import TemporaryDirectory
from contextlib import contextmanager
import io

from PIL import Image

from svgs import get_svg_filename

from selenium import webdriver
from selenium.webdriver import Remote as WebDriver
from selenium.webdriver import Keys, ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.common.exceptions import NoSuchDriverException

from slidie.render_xhtml import render_xhtml


# XXX: No cross platform webkit browser supported...
@pytest.fixture(scope="module", params=["chrome", "firefox"])
def browser(request: Any) -> str:
    """
    Parametrized fixture defining the browser to test with.
    """
    return request.param


@pytest.fixture(scope="module")
def driver(browser: str) -> Iterator[WebDriver]:
    """An single instance of each browser driver."""
    try:
        match browser:
            case "chrome":
                chrome_options = webdriver.ChromeOptions()
                chrome_options.add_argument("--headless=new")
                with webdriver.Chrome(options=chrome_options) as driver:
                    yield driver
            case "firefox":
                firefox_options = webdriver.FirefoxOptions()
                firefox_options.add_argument("-headless")
                with webdriver.Firefox(options=firefox_options) as driver:
                    yield driver
            case _:
                raise NotImplementedError(browser)
    except NoSuchDriverException:
        pytest.skip(f"{browser} not found by selenium")


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
            ]
        ):
            slide_name = tmp_path / f"{i}.svg"
            slide_name.write_bytes(get_svg_filename(slide).read_bytes())

        out_filename = tmp_path / "out.xhtml"
        render_xhtml(tmp_path, out_filename)

        yield out_filename


@pytest.fixture
def viewer(request: Any, driver: WebDriver, viewer_path: Path) -> WebDriver:
    """A freshly opened viewer (per test)."""
    driver.get(viewer_path.as_uri())
    return driver


def viewer_fullscreen(viewer: WebDriver) -> None:
    """Make the viewer full screen."""
    button = viewer.find_element(by=By.ID, value="full-screen")
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
            im = Image.open(io.BytesIO(viewer.get_screenshot_as_png()))
            colour = im.getpixel((im.width // 2, im.height // 2))[:3]

            assert colour == exp_colour

            viewer_next_step(viewer)

    def test_custom_hash(self, viewer: WebDriver) -> None:
        # Check non-default URL hashes are reflected in the UI and visa-versa

        slide_number_input = viewer.find_element(
            by=By.CSS_SELECTOR, value="#slide-selector .slide-number"
        )

        # Test UI -> URL hash
        with wait_for_url_change(viewer):
            slide_number_input.send_keys("negative_build_step_number#1" + Keys.ENTER)
        base_url, _, url_hash = viewer.current_url.partition("#")
        assert url_hash == "negative_build_step_number#1"

        # Test URL hash -> UI
        viewer.get(base_url + "#negative_build_step_number@foo")
        assert (
            slide_number_input.get_attribute("value")
            == "negative_build_step_number@foo"
        )
