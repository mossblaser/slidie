.. _xhtml-viewer:

The Slidie XHTML Viewer
=======================

The slidie XHTML viewer application is embedded into the :ref:`XHTML output
format <rendering-xhtml>` files. The viewer provides a simple read-only view of a
set of slides, along with a few presenter-oriented utilities.


User interface
--------------

The user interface should be fairly familliar consisting of the following major parts:

.. image:: _static/xhtml_viewer_annotated.png
    :alt: Annotated XHTML viewer screenshot.

1. **The current slide and step numbers.** These are displayed (and can
   be entered) using the same :ref:`syntax used for hyperlinks <links>`. The
   current position in the presentation is also reflected in the browser URL
   bar.

2. **The presentation title.** This is taken from the first slide's
   :ref:`metadata <metadata>`.

3. **Fullscreen button.** This will enter full-screen mode, hiding everything
   but the slides. Press escape to exit.

4. **Hide UI button.** This hides all of the viewer application's user
   interface but does not enter full screen mode. This may be useful when
   presenting via a video conferencing system. Press escape to restore the
   user interface.

5. **Presenter view button.** Open :ref:`presenter view <presenter-view>` in a
   new window.

6. **Help button.** Enumerates all keyboard shortcuts supported by the viewer.

7. **Slide thumbnail browser.** Tip: Hover over the slide number to show the
   source file name of a slide.

8. **Speaker notes.** Rendered as Markdown. :ref:`Speaker notes
   <speaker-notes>` not related to the current :ref:`build step <builds>` are
   shown dimly.

To advance through the show, either click (within the slide area) or use the
arrow keys. Other keyboard shortcuts are provided to skip more rapidly (e.g.
past :ref:`build steps <builds>` or to the beginning and end). See the built-in
help menu for the complete list.


.. _presenter-view:

Presenter view
--------------

Slidie's presenter view may be used in multi-display environments to provide
extra prompts to a presenter as they run through their slides. The presenter
view has the following major components:

.. image:: _static/xhtml_presenter_view_annotated.png
    :alt: Annotated XHTML presenter view screenshot.

1. **Current slide.**

2. **Next slide.**

3. **Speaker notes.**

4. **Current time.**

5. **Stopwatch.**

6. **Stopwatch controls.**


.. tip::

    The presenter view stopwatch is started automatically when the presentation
    is placed in full-screen mode.


.. warning::

    The slide previews unfortunately do not show a live view of any dynamic
    slide elements (e.g.  ;ref:`videos <video>` or :ref:`IFrames <iframe>`).



Browser quirks
--------------

The XHTML viewer application supports all major browser engines and browsers.
There are, however, a some known limitations in certain browsers:

Webkit (e.g. Safari)
    :ref:`Videos <video>` and :ref:`IFrames <iframe>` are not supported at the
    time of writing due to a rendering bug in this browser engine. These
    elements will currently render in a glitchy and unusable fashion.

Firefox
    Firefox's security rules prevent keyboard and mouse input from
    reaching :ref:`IFrames <iframe>` under certain circumstances when the
    viewer is opened directly from a file. Accessing the slides via a web
    server (e.g. ``python -m http.server``) is a possible workaround.
