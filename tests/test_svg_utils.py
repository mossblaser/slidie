from svgs import get_svg

from slidie.svg_utils import (
    enumerate_inkscape_layers,
    get_inkscape_layer_name,
)


def test_enumerate_inkscape_layers() -> None:
    root = get_svg("layers.svg")
    layers = enumerate_inkscape_layers(root)

    assert len(layers) == 3

    assert get_inkscape_layer_name(layers[0].element) == "Top layer"
    assert get_inkscape_layer_name(layers[1].element) == "Middle layer"
    assert get_inkscape_layer_name(layers[2].element) == "Bottom layer"

    assert len(layers[0].children) == 0
    assert len(layers[1].children) == 2
    assert len(layers[2].children) == 0

    assert len(layers[1].children) == 2
    assert (
        get_inkscape_layer_name(layers[1].children[0].element)
        == "Middle layer, top sublayer"
    )
    assert (
        get_inkscape_layer_name(layers[1].children[1].element)
        == "Middle layer, bottom sublayer"
    )

    assert len(layers[1].children[0].children) == 0
    assert len(layers[1].children[1].children) == 0
