/**
  * XML namespace resolver from 'common' name to full URI.
  */
function ns(name) {
  return {
    "svg": "http://www.w3.org/2000/svg",
    "xlink": "http://www.w3.org/1999/xlink",
    "inkscape": "http://www.inkscape.org/namespaces/inkscape",
    "sodipodi": "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd",
    "slidie": "http://xmlns.jhnet.co.uk/slidie/1.0",
  }[name];
}

/**
  * Given an SVG root node, find all SVG elements containing a slidie
  * 'steps' attribute.
  *
  * Returns a list of {elem, steps} objects where 'elem' is the SVG
  * element and 'steps' is the list of integer step numbers for that
  * layer.
  */
function findBuildSteps(svgRoot) {
  const out = [];
  for (const elem of svgRoot.querySelectorAll("*")) {
    // The following logic is equivalent to the following XPath 2.0 query, but
    // alas, Chrome doesn't yet support XPath 2.0 (unlike other browsers)...
    //
    //     //svg:*[@slidie:steps]
    //
    if (elem.namespaceURI == ns("svg") && elem.hasAttributeNS(ns("slidie"), "steps")) {
      const steps = JSON.parse(elem.getAttributeNS(ns("slidie"), "steps"));
      out.push({ elem, steps });
    }
  }
  
  return out;
}

/**
  * Given an array [{elem, steps}, ...], returns an array enumerating
  * the full step indices used by all build specs.
  */
function layerStepIndices(layerSteps) {
  const allSteps = layerSteps.map(({steps}) => steps).flat().concat([0]);
  const start = Math.min(...allSteps);
  const end = Math.max(...allSteps);
  
  const out = [];
  for (let i = start; i <= end; i++) {
    out.push(i);
  }
  return out;
}

/**
 * Given an SVG with embedded slidie thumbnails, return an array [{step,
 * dataUrl}, ...].
 */
function getThumbnails(svgRoot) {
  // The following logic is (a slacker...) equivalent to the following XPath
  // 2.0 query, but alas, Chrome doesn't yet support XPath 2.0 (unlike other
  // browsers)...
  //
  //     //slidie:thumbnails/slidie:thumbnail
  //
  const out = [];
  for (const parentElem of svgRoot.getElementsByTagNameNS(ns("slidie"), "thumbnails")) {
    for (const elem of parentElem.getElementsByTagNameNS(ns("slidie"), "thumbnail")) {
      const step = JSON.parse(elem.getAttribute("step"));
      const type = elem.getAttribute("type");
      const encoding = elem.getAttribute("encoding");
      const codedData = elem.innerHTML;
      
      const dataUrl = `data:${type};${encoding},${codedData}`;
      
      out.push({ step, dataUrl });
    }
  }
  
  return out;
}

/**
 * Given an SVG with embedded slidie speaker notes, return an array [{steps,
 * text}, ...].
 */
function getSpeakerNotes(svgRoot) {
  // The following logic is (a slacker...) equivalent to the following XPath
  // 2.0 query, but alas, Chrome doesn't yet support XPath 2.0 (unlike other
  // browsers)...
  //
  //     //slidie:notes/slidie:note
  //
  const out = [];
  for (const parentElem of svgRoot.getElementsByTagNameNS(ns("slidie"), "notes")) {
    for (const elem of parentElem.getElementsByTagNameNS(ns("slidie"), "note")) {
      let steps = null;
      if (elem.hasAttribute("steps")) {
        steps = JSON.parse(elem.getAttribute("steps"));
      }
      const text = elem.innerHTML;
      
      out.push({ steps, text });
    }
  }
  
  return out;
}

/**
 * Wraps an element in a shadow DOM within its parent document. Returns the
 * wrapper element.
 *
 * The tag argument sets the element type to use for the wrapper whilst the
 * className argument gives the class name to assign to that element.
 *
 * The mode argument gives the shadow DOM mode to use, defaulting to open
 * (allowing access to the contained element from the containing page's
 * Javascript).
 */
function wrapInShadowDom(elem, className="shadow-dom-wrapper", tag="div", mode="open") {
  // Create container node
  const container = elem.ownerDocument.createElement(tag);
  container.setAttribute("class", className);
  elem.parentNode.insertBefore(container, elem);
  
  // Move elem into new shadow DOM
  const shadowDom = container.attachShadow({ mode });
  shadowDom.append(elem);
  
  return container;
}


/**
 * Base type for Events dispatched on changes to the visible slide by
 * Stepper objects.
 *
 * Has the following useful properties:
 *
 * * slideElem -- the <svg> root element of the slide
 * * slide -- the slide number
 * * step -- the step index (always counting from 0)
 * * stepNumber -- the step number (as used in the build spec, may start from
 *   a number other than zero.)
 */
class StepperEvent extends Event {
  constructor(type, stepper) {
    super(type, {composed: true, cancelable: false, bubbles: true});
    this.slideElem = stepper.slides[stepper.curSlide];
    this.slide = stepper.curSlide;
    this.step = stepper.curSlideStep;
    this.stepNumber = stepper.slideBuildStepNumbers[stepper.curSlide][stepper.curSlideStep];
  }
}


/**
 * Given a zero-indexed slide number and zero-index step index, return a URL
 * hash which encodes that position.
 */
function toUrlHash(slide, step=0) {
  if (step == 0) {
    return `#${slide + 1}`
  } else {
    return `#${slide + 1}#${step + 1}`
  }
}

/**
 * Inverse of the toUrlHash function. Returns a [slide, step] pair or null if
 * the hash is not valid.
 */
function parseUrlHash(hash) {
  const match = window.location.hash.match(/^#([0-9]+)(#([-+]?[0-9]+))?$/);
  if (match !== null) {
    const slide = parseInt(match[1]) - 1;
    const step = parseInt(match[3] || "1") - 1;
    return [slide, step]
  } else {
    return null;
  }
}


/**
 * A class which steps through a slide show by showing/hiding SVGs and layers.
 *
 * Also dispatches the following events to the SVG root of the current slide
 * (which will non-cancellably bubble all the way to the non-shaddow document
 * root):
 *
 * * slidechange: When slide changes (but not on build step changes).
 * * stepchange: When the visible build step changes OR the slide changes.
 * * slideblank: When the screen is blanked
 * * slideunblank: When the screen is unblanked
 *
 * All events include a 'slide' and 'step' attribute giving the current
 * slide/step 
 */
class Stepper {
  /**
   * @param slides An array of SVG root elements, one per slide
   * @param containers An array of elements to show/hide to cause a slide to be
   *                   made visible/invisible.
   */
  constructor(slides, containers) {
    this.slides = slides;
    this.containers = containers;
    
    // Extract the build steps from all slides. NB: Build step numbers can
    // start from < 0. To keep things simpler, in all public functions of this
    // class we take build step indices (which are always zero based).
    this.slideBuilds = this.slides.map(slide => findBuildSteps(slide));
    this.slideBuildStepNumbers = this.slideBuilds.map(steps => layerStepIndices(steps));
    
    // Initially don't blank the screen
    this.blanked = false;
    
    // Start on the slide specified in the URL hash
    this.curSlide = null;
    this.curSlideStep = null;
    if (!this.showFromHash()) {
      // Fall back on the first slide if URL hash invalid/out of range
      this.show(0, 0);
    }
    
    // Move between slides based on URL changes
    window.addEventListener("hashchange", () => this.showFromHash());
  }
  
  /**
   * Show a particular slide/step.
   *
   * Returns true iff the slide exists, false otherwise.
   */
  show(slide, step=0) {
    // Check in range
    if (slide >= this.slides.length || step >= this.slideBuildStepNumbers[slide].length) {
      return false;
    }
    
    // Unblank if currently blanked
    if (this.blanked) {
      this.toggleBlank();
    }
    
    // Do nothing if already on correct slide (avoids producing change events
    // when nothing has actually changed)
    const slideChanged = this.curSlide !== slide;
    const stepChanged = this.curSlideStep !== step;
    if (!(slideChanged || stepChanged)) {
      return true;
    }
    
    this.curSlide = slide;
    this.curSlideStep = step;
    
    // Show the slide (and hide the others)
    for (const [index, container] of this.containers.entries()) {
      container.style.display = index == slide ? "block" : "none";
    }
    
    // Show the appropriate layers for the given build step
    for (const build of this.slideBuilds[slide]) {
      if (build.steps.indexOf(this.slideBuildStepNumbers[slide][step]) >= 0) {
        build.elem.style.display = "block";
      } else {
        build.elem.style.display = "none";
      }
    }
    
    // Update the URL with the new offset
    window.location.hash = toUrlHash(this.curSlide, this.curSlideStep);
    
    // Fire change events
    if (slideChanged) {
      this.slides[this.curSlide].dispatchEvent(new StepperEvent("slidechange", this));
    }
    this.slides[this.curSlide].dispatchEvent(new StepperEvent("stepchange", this));
    
    return true;
  }
  
  /**
   * Toggle blanking of the show. Returns true iff now blanked.
   *
   * NB: Blanking is turned off when attempting to change slide.
   */
  toggleBlank() {
    this.blanked = !this.blanked;
    
    for (const container of this.containers) {
      // NB: We set 'visibility' rather than 'disblay' partly to keep things
      // easy and also to avoid triggering reflow or (over-zealous)
      // re-rendering of the SVGs
      container.style.visibility = this.blanked ? "hidden" : "visible";
    }
    
    // Fire blanking/unblanking event
    const eventType = this.blanked ? "slideblank" : "slideunblank";
    this.slides[this.curSlide].dispatchEvent(new StepperEvent(eventType, this));
    
    return this.blanked;
  }
  
  /**
   * Show the slide specified in the URL hash. Returns true iff the hash is
   * valid and refers to an existing slide.
   *
   * There is no reason to call this method externally since it will already be
   * called on instantiation and after a hashchange event anyway.
   */
  showFromHash() {
    const match = parseUrlHash(window.location.hash);
    if (match !== null) {
      return this.show(match[0], match[1]);
    } else {
      return false;
    }
  }
  
  /** Advance to the next step (and then slide). Returns true iff one exists. */
  nextStep() {
    let slide = this.curSlide;
    let step = this.curSlideStep;
    
    if (this.blanked) {
      // Don't advance if slide blanked, but do re-show the slide
    } else if (step + 1 < this.slideBuildStepNumbers[slide].length) {
      step += 1;
    } else if (slide + 1 < this.slides.length) {
      step = 0;
      slide += 1;
    } else {
      // Already at end, no-op
      return false;
    }
    
    return this.show(slide, step);
  }
  
  /**
   * Advance to the first step of the next slide (skipping any remaining build
   * steps on the current slide). Returns true iff one exists.
   */
  nextSlide() {
    let slide = this.curSlide;
    let step = this.curSlideStep;
    
    if (this.blanked) {
      // Don't advance if slide blanked, but do re-show the slide
    } else if (slide + 1 < this.slides.length) {
      step = 0;
      slide += 1;
    } else {
      // Already at end, no-op
      return false;
    }
    
    return this.show(slide, step);
  }
  
  /** Return to the previous step (and then slide). Returns true iff one exists. */
  previousStep() {
    let slide = this.curSlide;
    let step = this.curSlideStep;
    
    if (this.blanked) {
      // Don't move back if slide blanked, but do re-show the slide
    } else if (step - 1 >= 0) {
      step -= 1;
    } else if (slide - 1 >= 0) {
      slide -= 1;
      step = this.slideBuildStepNumbers[slide].length - 1;
    } else {
      // Already at start, no-op
      return false;
    }
    
    return this.show(slide, step);
  }
  
  /**
   * Return to the first step of the current slide if not already on it.
   * Otherwise, returns to the first step of the previous slide (skipping any
   * interevening build steps on the current slide). Returns true iff one
   * exists.
   */
  previousSlide() {
    let slide = this.curSlide;
    let step = this.curSlideStep;
    
    if (this.blanked) {
      // Don't move back if slide blanked, but do re-show the slide
    } else if (step > 0) {
      step = 0;
    } else if (slide - 1 >= 0) {
      slide -= 1;
      step = 0;
    } else {
      // Already at start, no-op
      return false;
    }
    
    return this.show(slide, step);
  }
  
  /**
   * Go to the first build step of the first slide.
   */
  start() {
    return this.show(0, 0);
  }
  
  /**
   * Go to the last build step of the last slide.
   */
  end() {
    if (this.slides.length >= 1) {
      return this.show(
        this.slides.length - 1,
        this.slideBuildStepNumbers[this.slides.length - 1].length - 1,
      );
    } else {
      // No slides, no-op.
      return false;
    }
  }
}


/**
 * Load the thumbnails embedded in the slides, populating the thumbnails
 * sidebar.
 */
function loadThumbnails(slides) {
  const thumbnailsElem = document.getElementById("thumbnails")
  
  const thumbnailGroupTemplate = document.getElementById("thumbnail-group")
  const thumbnailTemplate = document.getElementById("thumbnail")
  
  // For each slide (shown as a group of thumbnails: one for each step)...
  const numberedThumbs = Array.from(slides.map(getThumbnails).entries());
  const thumbElems = numberedThumbs.map(([slideNum, slideThumbs]) => {
    const groupElem = thumbnailGroupTemplate.content.cloneNode(true).firstElementChild;
    thumbnailsElem.appendChild(groupElem);
    
    // Show slide number
    groupElem.querySelector(".slide-number").innerText = `${slideNum + 1}`;
    
    // Add thumbnails for each step
    const slideThumbnailsElem = groupElem.querySelector(".slide-thumbnails");
    numberedSlideThumbs = Array.from(slideThumbs.entries());
    return numberedSlideThumbs.map(([stepNum, {step, dataUrl}]) => {
      const elem = thumbnailTemplate.content.cloneNode(true).firstElementChild;
      slideThumbnailsElem.appendChild(elem)
      
      // Add link and tooltip
      const sourceFilename = slides[slideNum].getAttributeNS(ns("slidie"), "source");
      elem.title = `${sourceFilename}\nstep number ${step}`;
      elem.href = toUrlHash(slideNum, stepNum);
      
      // Set image
      const imgElem = elem.querySelector("img");
      imgElem.src = dataUrl;
      imgElem.alt = `Slide ${slideNum + 1}, step ${stepNum + 1}`;
      
      return elem;
    });
  });
  
  // Apply the 'selected' class to the currently selected slide
  window.addEventListener("stepchange", ({slide, step}) => {
    for (const [thisSlide, steps] of thumbElems.entries()) {
      for (const [thisStep, elem] of steps.entries()) {
        if (thisSlide === slide && thisStep === step) {
          elem.classList.add("selected");
          elem.scrollIntoView({ block: "nearest", inline: "nearest" });
        } else {
          elem.classList.remove("selected");
        }
      }
    }
  });
}


/**
 * A wrapper around the Marked markdown parser which parses the generated HTML
 * and returns a NodeList of the corresponding elements.
 */
function markdownToXHTML(source) {
  const html = marked.parse(source)
  const mdDocument = new DOMParser().parseFromString(html, "text/html");
  return mdDocument.body.childNodes;
}


/**
 * Load (and parse the markdown of) the speaker notes in each slide, and setup
 * callbacks to display the current slide's notes in the #notes container.
 */
function loadNotes(slides) {
  const container = document.getElementById("notes");
  const template = document.getElementById("note");
  
  // For each slide, an array [{steps, elem}, ...] giving a series of DOM
  // elements to insert into the notes viewer and the step indices at which
  // those elements should have the 'current' class applied.
  const slideNotes = [];
  for (const slide of slides) {
    slideNotes.push(getSpeakerNotes(slide).map(({steps, text}) => {
      const elem = template.content.cloneNode(true).firstElementChild;
      markdownToXHTML(text).forEach(n => elem.appendChild(n));
      return {steps, elem};
    }));
  }
  
  // Update the notes container as we navigate through the show
  let curSlide = null;
  window.addEventListener("stepchange", ({slide, stepNumber}) => {
    // On slide change, replace the notes
    if (curSlide !== slide) {
      curSlide = slide;
      Array.from(container.childNodes).forEach(elem => elem.remove());
      slideNotes[slide].forEach(({elem}) => container.appendChild(elem));
    }
    
    // Mark the appropriate notes as current
    for (const {steps, elem} of slideNotes[slide]) {
      if (steps === null || steps.indexOf(stepNumber) >= 0) {
        elem.classList.add("current");
      } else {
        elem.classList.remove("current");
      }
    }
  });
}


/******************************************************************************/

(() => {
  // Find the slides in the document
  const slidesContainerElem = document.getElementById("slides");
  
  // Wrap all slides in a Shadow DOM to give them all their own namespaces for
  // IDs etc.
  const slides = Array.from(slidesContainerElem.children);
  const slideContainers = slides.map(slide => wrapInShadowDom(slide, "slide-container"));
  
  // Expand SVGs to fill their container (which will be sized and positioned
  // via CSS more conventionally). Only necessary because the SVG element is in
  // a Shadow DOM and thus can't be styled directly
  for (const slide of slides) {
    slide.style.display = "block";
    slide.style.width = "100%";
    slide.style.height = "100%";
  }
  
  // NB: Perform these steps *before* creating the stepper so the initial
  // slide change events are caught to setup the initial UI state.
  loadThumbnails(slides);
  loadNotes(slides);
  
  const stepper = new Stepper(slides, slideContainers);
    
  // Click to advance by one step
  slidesContainerElem.addEventListener("click", evt => {
    stepper.nextStep();
    evt.preventDefault();
    evt.stopPropagation();
    return false;
  });
  
  // Keyboard navigation
  window.addEventListener("keydown", evt => {
    // No keyboard shortcuts have modifiers (we'll ignore shift for now!) --
    // prevent handling of these cases to ensure (e.g.) browser history
    // shortcuts work as usual.
    if (evt.altKey || evt.ctrlKey || evt.metaKey) {
      return;
    }
    
    switch (evt.key) {
      // Left/Down or Right/Up: Move a step at a time
      case "ArrowUp":
      case "ArrowLeft":
        stepper.previousStep();
        break;
      case "ArrowDown":
      case "ArrowRight":
        stepper.nextStep();
        break;
      
      // Page up/down: Move a slide at a time
      case "PageUp":
        stepper.previousSlide();
        break;
      case "PageDown":
        stepper.nextSlide();
        break;
      
      // Home/End: Jump to first or last step
      case "Home":
        stepper.start();
        break;
      case "End":
        stepper.end();
        break;
      
      // 'Z', 'B' or '.': Toggle blanking the screen.
      //case "Z":
      case "z":
      case "Z":
      case "b":
      case "B":
      case ".":
        stepper.toggleBlank();
        break;
      
      // Other keys: Do nothing.
      default:
        return;
    }
    
    evt.preventDefault();
    evt.stopPropagation();
  });
 })();

