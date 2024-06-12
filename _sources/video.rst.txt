.. _video:

Video
=====

Basic support for adding videos to slides is included in Slidie via the
``video`` :ref:`magic text <magic-text>` value.

.. warning::

    Video support in Slidie is relatively limited and comes with far more
    caveats than other features.
    
    The author would feel worse about this if not for the fact that every other
    presentation tool seems to fumble video handling in their own unique ways.

Embedded videos are only supported in the :ref:`XHTML viewer
<rendering-xhtml>`. The user-defined placeholder will be shown in other
output formats.

.. note::

    Whilst PDF *technically* includes support for embedding videos, it is not
    usable in practice. For example, viewer support is extremely limited and
    often very unreliable. Implementing video embeddings which happen to be
    compatible with the already-small pool of capable viewers is also
    horrendous and involves things like Flash(!) and undocumented Javascript
    APIs. In short, I'm afraid the author eventually concluded that they did
    not want to go there, despite serious good-faith efforts to do so.

.. image:: _static/video_inkscape_screenshot.png
    :alt:
        A screenshot of a video defined in Inkscape using Slidie's magic text
        feature.

.. image:: _static/video_viewer_screenshot.png
    :alt:
        A screenshot of a video playing on a slide.


Inserting a video
-----------------

To insert a video into a slide, insert a :ref:`placeholder rectangle or image
<magic-rectangles>` grouped with a :ref:`magic text <magic-text>` box with one
of the following forms:

::

    @@@
    video = "<video URL here>"  # Short form

::

    @@@
    # Long form
    [video]
    url = "<video URL here>"
    start = 0.0  # Start offset, seconds (optional)
    loop = false  # Repeatedly play video (optional)
    mute = false  # Mute audio (optional)

Video URLs may point to online resources or be relative URLs to files stored
adjacently to the rendered XHTML viewer.

.. warning::

    Slidie does not attempt to embed videos within the generated XHTML output
    due to `browser limitations on data URL lengths
    <https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs#length_limitations>`_.
    Care must be taken to ensure that local video files are stored and
    distributed together with the generated XHTML output in the correct
    relative location.

.. warning::

    Some browsers refuse to play video from plain HTTP (non-HTTPS) URLs when
    the viewer is loaded from a ``file://`` URL.

The optional ``start`` time controls the point at which the video will play.

If ``loop`` is true, the video will be restart from the beginning when it
reaches the end (even if ``start`` is set to a non-zero value).

If ``mute`` is true, audio will be muted.

.. warning::

    Due to browser autoplay restrictions, videos placed on the first slide in
    the show will not play until you first move to another slide and then back
    again. Videos on other slides should play correctly, however.

.. note::

    Slidie currently does not include any mechanism for controling playback:
    media will always automatically start from the specified offset upon
    entering the slide and play to completion (or slide exit, if ``loop`` is
    set). This may be addressed in a future release. In the meantime, some
    browsers allow you to right-click and choose 'show controls'.



.. _slidie-video-stills:


Automatic video placeholder generation
--------------------------------------

The ``slidie-video-stills`` command will automatically extract a still frame
from embedded videos and insert it as the placeholder image for the video.

Usage::

    $ slidie-video-stills path/to/slide.svg

Using ``slidie-video-stills``, you can quicly lay out videos your slides using
simple rectangle placeholders and later replace them automatically with stills
for the benefit of thumbnails and non-XHTML output formats.
