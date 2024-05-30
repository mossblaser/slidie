import pytest

from slidie.render_xhtml.browser_magic import (
    IFrameMagicParameters,
    normalise_iframe_magic_parameters,
)


class TestNormaliseIFrameParameters:
    def test_url_only(self) -> None:
        assert normalise_iframe_magic_parameters("/foo") == IFrameMagicParameters(
            url="/foo",
            scale=1.0,
            name=None,
        )

    def test_defaults(self) -> None:
        assert normalise_iframe_magic_parameters({}) == IFrameMagicParameters(
            url="about:blank",
            scale=1.0,
            name=None,
        )

    def test_manual_spec(self) -> None:
        assert normalise_iframe_magic_parameters(
            {
                "url": "/foo",
                "scale": 2.0,
                "name": "bar",
            }
        ) == IFrameMagicParameters(
            url="/foo",
            scale=2.0,
            name="bar",
        )

    @pytest.mark.parametrize(
        "url, query, exp_url",
        [
            # Empty
            ("/foo?a=b", [], "/foo?a=b"),
            ("/foo?a=b", {}, "/foo?a=b"),
            # Simple additions
            ("/foo?a=b", {"c": "d"}, "/foo?a=b&c=d"),
            ("/foo?a=b", [{"name": "c", "value": "d"}], "/foo?a=b&c=d"),
            # Full URL
            (
                "http://example.com:80/foo?a=b#hash",
                {"c": "d"},
                "http://example.com:80/foo?a=b&c=d#hash",
            ),
            # URL encoding (NB: also in original URL too to make sure this is
            # being correctly serialised/deserialised
            ("/foo?a=b+plus%2b", {"c": "d plus+"}, "/foo?a=b+plus%2B&c=d+plus%2B"),
            # Repeated keys
            ("/foo?a=b", {"a": "c"}, "/foo?a=b&a=c"),
            ("/foo?a=b", {"a": ["c", "d"]}, "/foo?a=b&a=c&a=d"),
            (
                "/foo?a=b",
                [{"name": "a", "value": "c"}, {"name": "a", "value": "d"}],
                "/foo?a=b&a=c&a=d",
            ),
            # Empty keys
            ("/foo?a&b=", {"c": ""}, "/foo?a=&b=&c="),
        ],
    )
    def test_query(
        self,
        url: str,
        query: list[dict[str, str]] | dict[str, str | list[str]],
        exp_url: str,
    ) -> None:
        assert (
            normalise_iframe_magic_parameters(
                {
                    "url": url,
                    "query": query,
                }
            ).url
            == exp_url
        )
