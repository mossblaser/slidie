/**
  * XML namespace resolver from 'common' name to full URI.
  */
function ns(name) {
  return {
    "svg": "http://www.w3.org/2000/svg",
    "xhtml": "http://www.w3.org/1999/xhtml",
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
  * Returns a list of {elem, steps, tags} objects where 'elem' is the SVG
  * element and 'steps' is the list of integer step numbers for that layer and
  * 'tags' is the list of tags assigned to that layer.
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
      const tags = JSON.parse(elem.getAttributeNS(ns("slidie"), "tags") || "[]");
      out.push({ elem, steps, tags });
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
 * Given an array [{elem, steps}, ...], returns an Map from tag names to
 * (zero-indexed) step indices.
 */
function layerStepTags(layerSteps) {
  const stepNumbers = layerStepIndices(layerSteps);
  
  const map = new Map();
  
  for (const {steps, tags}  of layerSteps) {
    const stepNumber = Math.min(0, ...steps);
    const step = stepNumbers.indexOf(stepNumber);
    
    for (const tag of tags) {
      map.set(tag, step);
    }
  }
  
  return map;
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
 *
 * The 'composed' argument can be set to false to prevent the event bubbling
 * out of the slide in which it was sent to to the top level DOM.
 */
class StepperEvent extends Event {
  constructor(type, stepper, composed = true) {
    super(type, {composed, cancelable: false, bubbles: true});
    this.slideElem = stepper.curSlideElem;
    this.slide = stepper.curSlide;
    this.step = stepper.curSlideStep;
    this.stepNumber = stepper.curSlideStepNumber;
  }
}


/**
 * Given a zero-indexed slide number and zero-indexed step index, return a URL
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
 * Parse a (already-uri-decoded) URL hash, resolving the specification into a
 * [slide, step] pair.
 *
 * Returns null if an *syntactically* invalid link is provided.
 *
 * Out-of-range slide/step numbers are returned as-is.
 *
 * When an unknown slide_id is given, returns null. Conversely an unknown build
 * step tag or out-of-range build step number is given, the step is treated as
 * zero instead.
 *
 * @param currentSlide The current 0-indexed slide number.
 * @param slideIds A Map() from slide ID to slide index.
 * @param slideBuildStepNumbers An array of arrays giving the step numbers of
 *        each step.
 * @param slideBuildStepTags An array of Map() from tag to step index, one per
 *        slide.
 */
function parseUrlHash(
  hash,
  currentSlide,
  slideIds,
  slideBuildStepNumbers,
  slideBuildStepTags,
) {
  const linkRegex = new RegExp(
    "^#" +
    // Slide spec
    "(?:" +
      "(?<slide_index>[0-9]+)" +
      "|" +
      "(?<slide_id>[^0-9#@<][^#@<]*)" +
    ")?" +
    // Build step spec
    "(?:" +
      "(?:#(?<step_index>[0-9]+))" +
      "|" +
      "(?:<(?<step_number>[-+]?[0-9]+)>)" +
      "|" +
      "(?:@(?<step_tag>[^\\s<>.@]+))" +
    ")?" +
    "$"
  );
  
  const match = linkRegex.exec(hash);
  
  if (match === null) {
    return null;
  }
  
  // Work out slide index
  let slide = currentSlide;
  if (match.groups.slide_index !== undefined) {
    slide = parseInt(match.groups.slide_index) - 1;
  } else if (match.groups.slide_id !== undefined) {
    const slideId = match.groups.slide_id;
    if (slideIds.has(slideId)) {
      slide = slideIds.get(slideId);
    } else {
      // Unknown slide ID
      return null;
    }
  }
  
  // Work out step index
  let step = 0;
  if (match.groups.step_index !== undefined) {
    step = parseInt(match.groups.step_index) - 1;
  } else if (match.groups.step_number !== undefined) {
    if (slide < slideBuildStepNumbers.length) {
      step = slideBuildStepNumbers[slide].indexOf(parseInt(match.groups.step_number));
      if (step < 0) { // Treat non-existant step number as zero
        step = 0;
      }
    }
  } else if (match.groups.step_tag !== undefined) {
    if (slide < slideBuildStepTags.length) {
      const tag = match.groups.step_tag;
      if (slideBuildStepTags[slide].has(tag)) {
        step = slideBuildStepTags[slide].get(tag);
      }
    }
  }
  
  return [slide, step];
}

/**
 * Enumerate the complete set of absolute slide hashes. Takes a list of slide
 * <svg> root elements. Returns all possible combinations of hash.
 *
 * Does not include 'relative' hashes where the current slide is implied.
 */
function enumerateSlideHashes(slides) {
  const out = [];
  
  for (const [slideNum, slide] of slides.entries()) {
    // Enumerate ways of identifying the slide
    const slideValues = [`${slideNum + 1}`];
    if (slide.hasAttributeNS(ns("slidie"), "id")) {
      slideValues.push(slide.getAttributeNS(ns("slidie"), "id"));
    }
    
    // Enumerate ways of identifying the step
    const stepValues = [];
    const layerSteps = findBuildSteps(slide);
    for (const [step, stepNumber] of layerStepIndices(layerSteps).entries()) {
      stepValues.push(`#${step + 1}`);
      stepValues.push(`<${stepNumber}>`);
    }
    for (const tag of layerStepTags(layerSteps).keys()) {
      stepValues.push(`@${tag}`);
    }
    
    // Enumerate all combinations of the above
    for (const slideValue of slideValues) {
      out.push(`${slideValue}`);
      for (const stepValue of stepValues) {
        out.push(`${slideValue}${stepValue}`);
      }
    }
  }
  
  return out;
}


/**
 * A class which steps through a slide show by showing/hiding SVGs and layers.
 *
 * Also dispatches the following events to the SVG root of the current slide
 * (which will non-cancellably bubble all the way to the non-shaddow document
 * root):
 *
 * * slideenter: When entering a slide (but not between steps)
 * * slideexit: When leaving a slide. NB: Contains the slide details of the
 *   slide which replaces it. NB: Unlike other events, this does not bubble out
 *   of the slide it is raised in.
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
    
    // Extract IDs from slides which have them
    this.slideIds = new Map();
    for (const [slide, elem] of this.slides.entries()) {
      if (elem.hasAttributeNS(ns("slidie"), "id")) {
        const id = elem.getAttributeNS(ns("slidie"), "id");
        this.slideIds.set(id, slide);
      }
    }
    
    // Extract the build steps from all slides. NB: Build step numbers can
    // start from < 0. To keep things simpler, in all public functions of this
    // class we take build step indices (which are always zero based).
    this.slideBuilds = this.slides.map(slide => findBuildSteps(slide));
    this.slideBuildStepNumbers = this.slideBuilds.map(layerSteps => layerStepIndices(layerSteps));
    this.slideBuildStepTags = this.slideBuilds.map(layerSteps => layerStepTags(layerSteps));
    
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
  
  get curSlideElem() {
    return this.slides[this.curSlide];
  }
  
  get curSlideStepNumber() {
    return this.slideBuildStepNumbers[this.curSlide][this.curSlideStep];
  }
  
  /**
   * Show a particular slide/step.
   *
   * The updateHash argument is intended for use only by showFromHash and may
   * be used to prevent the hash in the URL from being changed to match the
   * current slide. This ensures that if the user uses a particular hash format
   * to specify the slide/step we don't immediately replace that.
   *
   * Returns true iff the slide exists, false otherwise.
   */
  show(slide, step=0, updateHash=true) {
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
    
    const lastSlide = this.curSlide;
    const lastStep = this.curSlideStep;
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
    if (updateHash) {
      window.location.hash = toUrlHash(this.curSlide, this.curSlideStep);
    }
    
    // Fire change events
    if (slideChanged) {
      this.slides[this.curSlide].dispatchEvent(new StepperEvent("slideenter", this));
      if (lastSlide !== null) {
        this.slides[lastSlide].dispatchEvent(new StepperEvent("slideexit", this, false));
      }
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
    const match = parseUrlHash(
      decodeURI(window.location.hash),
      this.curSlide,
      this.slideIds,
      this.slideBuildStepNumbers,
      this.slideBuildStepTags,
    );
    if (match !== null) {
      return this.show(match[0], match[1], false);
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
function loadThumbnails(stepper, container) {
  const thumbnailGroupTemplate = document.getElementById("thumbnail-group")
  const thumbnailTemplate = document.getElementById("thumbnail")
  
  // For each slide (shown as a group of thumbnails: one for each step)...
  const numberedThumbs = Array.from(stepper.slides.map(getThumbnails).entries());
  const thumbElems = numberedThumbs.map(([slideNum, slideThumbs]) => {
    const groupElem = thumbnailGroupTemplate.content.cloneNode(true).firstElementChild;
    container.appendChild(groupElem);
    
    // Show slide number
    groupElem.querySelector(".slide-number").innerText = `${slideNum + 1}`;
    
    // Add thumbnails for each step
    const slideThumbnailsElem = groupElem.querySelector(".slide-thumbnails");
    numberedSlideThumbs = Array.from(slideThumbs.entries());
    return numberedSlideThumbs.map(([stepNum, {step, dataUrl}]) => {
      const elem = thumbnailTemplate.content.cloneNode(true).firstElementChild;
      slideThumbnailsElem.appendChild(elem)
      
      // Add link and tooltip
      const sourceFilename = stepper.slides[slideNum].getAttributeNS(ns("slidie"), "source");
      elem.title = `${sourceFilename}\nstep number ${step}`;
      elem.href = toUrlHash(slideNum, stepNum);
      
      // Set image
      const imgElem = elem.querySelector("img");
      imgElem.src = dataUrl;
      imgElem.alt = `Slide ${slideNum + 1}, step ${stepNum + 1}`;
      
      return elem;
    });
  });
  
  // Apply the 'selected' and 'next' classes to the currently selected slide
  function onStepChange({slide, step}) {
    let lastSlideSelected = false
    for (const [thisSlide, steps] of thumbElems.entries()) {
      for (const [thisStep, elem] of steps.entries()) {
        if (thisSlide === slide && thisStep === step) {
          elem.classList.add("selected");
          elem.scrollIntoView({ block: "nearest", inline: "nearest" });
          
          lastSlideSelected = true;
          elem.classList.remove("next");
        } else {
          elem.classList.remove("selected");
          
          if (lastSlideSelected) {
            elem.classList.add("next");
            lastSlideSelected = false;
          } else {
            elem.classList.remove("next");
          }
        }
      }
    }
  }
  window.addEventListener("stepchange", onStepChange);
  onStepChange({slide: stepper.curSlide, step: stepper.curSlideStep});
}


/**
 * Display thumbnails of the current and next slides into the provided images.
 */
function loadNowNextThumbnails(stepper, nowImg, nextImg) {
  // Create an array of arrays of {now, next} objects, one for each step of
  // each slide.
  const allThumbs = [];
  let lastStep = {};
  for (const [slide, steps] of Array.from(stepper.slides.map(getThumbnails)).entries()) {
    const slideThumbs = [];
    for (const [step, {dataUrl}] of steps.entries()) {
      lastStep.next = dataUrl;
      const thisStep = lastStep = {now: dataUrl};
      slideThumbs.push(thisStep);
    }
    allThumbs.push(slideThumbs);
  }
  
  // Update the now/next images
  function setThumbs({slide, step}) {
    const {now, next} = allThumbs[slide][step];
    nowImg.src = now;
    
    if (next !== undefined) {
      nextImg.src = next;
      nextImg.style.visibility = "visible";
    } else {
      nextImg.src = now;  // Just for consistency of behavior
      nextImg.style.visibility = "hidden";
    }
  }
  window.addEventListener("stepchange", setThumbs);
  setThumbs({slide: stepper.curSlide, step: stepper.curSlideStep});
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
function loadNotes(stepper, container) {
  const template = document.getElementById("note");
  
  // For each slide, an array [{steps, elem}, ...] giving a series of DOM
  // elements to insert into the notes viewer and the step indices at which
  // those elements should have the 'current' class applied.
  const slideNotes = [];
  for (const slide of stepper.slides) {
    slideNotes.push(getSpeakerNotes(slide).map(({steps, text}) => {
      const elem = template.content.cloneNode(true).firstElementChild;
      markdownToXHTML(text).forEach(n => elem.appendChild(n));
      return {steps, elem};
    }));
  }
  
  // Update the notes container as we navigate through the show
  let curSlide = null;
  function onStepChange({slide, stepNumber}) {
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
  }
  window.addEventListener("stepchange", onStepChange);
  onStepChange({slide: stepper.curSlide, stepNumber: stepper.curSlideStepNumber})
}

/**
 * Setup automatic video play/pause on slide entry/exit for videos inserted
 * using magic text.
 */
function setupMagicVideoPlayback(slides) {
  for (const slide of slides) {
    for (const video of slide.getElementsByTagNameNS(ns("xhtml"), "video")) {
      if (video.hasAttributeNS(ns("slidie"), "magic")) {
        const start = parseFloat(video.getAttributeNS(ns("slidie"), "start") || "0");
        const steps = JSON.parse(video.getAttributeNS(ns("slidie"), "steps") || "null");
        
        video.currentTime = start;
        
        slide.addEventListener("stepchange", ({stepNumber}) => {
          if (steps === null || steps.indexOf(stepNumber) >= 0) {
            video.play();  // NB: NOP if already playing
          } else {
            video.pause();
            video.currentTime = start;
          }
        });
        
        slide.addEventListener("slideexit", () => {
          video.pause();
          video.currentTime = start;
        });
      }
    }
  }
}

/**
 * Given an event, test whether that event involves any kind of hyperlink or
 * button not (specifically an XHTML or SVG <a> or <button> or <input> tag). If
 * it does, returns true.  Otherwise returns false.
 */
function eventInvolvesHyperlink(evt) {
  for (const elem of evt.composedPath()) {
    if (
      (
        (elem.namespaceURI == ns("xhtml") || elem.namespaceURI == ns("svg"))
        && elem.localName == "a"
      ) || (
        elem.namespaceURI == ns("xhtml") && (
          elem.localName == "button"
          || elem.localName == "input"
        )
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Sets the specified class on the specified element whenever the mouse hasn't
 * moved over it in the last timeout milliseconds.
 */
function setClassWhileMouseIdle(elem, className="mouse-idle", timeout=2000) {
  let timeoutId = null;
  elem.addEventListener("mousemove", evt => {
    elem.classList.remove(className)
    
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      elem.classList.add(className)
      timeoutId = null;
    }, timeout);
  });
}

/**
 * Setup the textual slide selection box.
 */
function setupSlideSelector(stepper) {
  const slideSelectorElem = document.getElementById("slide-selector");
  
  // Set overall slide count
  slideSelectorElem.querySelector(".slide-count").innerText = stepper.slides.length;
  
  const slideNumberBox = slideSelectorElem.querySelector(".slide-number");
  
  // Show the current slide number
  function update() {
    // NB: Hash is updated by Stepper just before stepchange is emitted and
    // will contain the same syntax entered by the user.
    slideNumberBox.value = decodeURI(window.location.hash.substring(1));
    slideNumberBox.style.width = `${Math.max(3, slideNumberBox.value.length)}em`;
  }
  window.addEventListener("stepchange", update);
  update();
  
  // Allow changing the slide number
  slideNumberBox.addEventListener("change", () => {
    window.location.hash = `#${slideNumberBox.value}`;
    slideNumberBox.blur();
  });
  
  // Select/defocus box on click/exit
  slideNumberBox.addEventListener("focus", () => { slideNumberBox.select(); });
  slideNumberBox.addEventListener("keydown", evt => {
    if (evt.key == "Escape" || evt.key == "Enter") {
      slideNumberBox.blur();
    }
    // Prevent the slide navigation keyboard handler running
    evt.stopPropagation();
  });
  
  // Setup auto-completion values
  const dataList = slideSelectorElem.querySelector("datalist");
  for (const value of enumerateSlideHashes(stepper.slides)) {
    const option = document.createElementNS(ns("xhtml"), "option");
    option.value = value;
    dataList.appendChild(option);
  }
}

/**
 * Given a duration in milliseconds, format this in human-readable terms of
 * hours, minutes and seconds.
 */
function formatDuration(milliseconds) {
  let seconds = Math.floor(milliseconds / 1000);
  
  const hours = Math.floor(seconds / (60 * 60));
  seconds -= hours * 60 * 60;
  
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  
  const hh = hours.toString();
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  
  if (hours > 0) {
    return `${hh}:${mm}:${ss}`;
  } else {
    return `${minutes}:${ss}`;
  }
}

/**
 * Simple state machine for a stopwatch-style timer intended for the presenter
 * view.
 */
class Stopwatch {
  constructor(timerRunning=false) {
    this.reset();
    this.timerRunning = timerRunning;
  }
  
  /** Pause the timer. */
  pause() {
    if (this.timerRunning) {
      this.timerEnd = Date.now();
      this.timerRunning = false;
    }
  }
  
  /** Resume the timer. */
  resume() {
    if (!this.timerRunning) {
      const now = Date.now();
      this.timerStart += now - this.timerEnd;
      this.timerEnd = now;
      this.timerRunning = true;
    }
  }
  
  /** Toggle the pause state. Returns 'true' iff now running. */
  togglePause() {
    if (this.timerRunning) {
      this.pause();
    } else {
      this.resume();
    }
    
    return this.timerRunning;
  }
  
  /** Reset the timer */
  reset() {
    this.timerStart = Date.now();
    this.timerEnd = this.timerStart;
  }
  
  /** Return the number of milliseconds on the timer. */
  read() {
    if (this.timerRunning) {
      this.timerEnd = Date.now();
    }
    return this.timerEnd - this.timerStart;
  }
}

/** Clone an event object. */
function cloneEvent(evt) {
  return new evt.constructor(evt.type, evt);
}

/**
 * Show the current slide number (and slide count) in the provided pair of
 * elements.
 */
function showSlideNumber(stepper, slideNumberElem, slideCountElem) {
  // Show slide number
  function updateSlideNumber({slide}) {
    slideNumberElem.innerText = (slide + 1).toString();
  }
  window.addEventListener("stepchange", updateSlideNumber)
  updateSlideNumber({slide: stepper.curSlide});
  
  // Show slide count
  slideCountElem.innerText = stepper.slides.length.toString();
}

/**
 * Display the time and stopwatch, along with control buttons.
 */
function setupStopwatchUI(stopwatch, clockElem, timerElem, pauseButton, resetButton) {
  // Continuously refresh time
  function updateTimers() {
    clockElem.innerText = new Date().toLocaleTimeString();
    timerElem.innerText = formatDuration(stopwatch.read());
    
    if (stopwatch.timerRunning) {
      pauseButton.innerText = "Pause";
      pauseButton.classList.add("pause");
      pauseButton.classList.remove("resume");
    } else {
      if (stopwatch.read() == 0) {
        pauseButton.innerText = "Start";
      } else {
        pauseButton.innerText = "Resume";
      }
      pauseButton.classList.add("resume");
      pauseButton.classList.remove("pause");
    }
  }
  window.setInterval(updateTimers, 1000);
  updateTimers();
  
  // Setup buttons
  pauseButton.addEventListener("click", evt => {
    stopwatch.togglePause();
    updateTimers();
    evt.stopPropagation();
  });
  resetButton.addEventListener("click", evt => {
    stopwatch.reset();
    updateTimers();
    evt.stopPropagation();
  });
}

/**
 * Create a presenter view window and link it up to the main Slidie UI. Returns
 * a reference to the created window.
 */
function showPresenterView(stepper, stopwatch, clickForwardingTarget) {
  const wnd = window.open("", "presenter-view", {popup: true});
  
  // Instantiate the presenter view template
  const presenterViewTemplaate = document.getElementById("presenter-view-template");
  const root = presenterViewTemplaate.content.cloneNode(true).firstElementChild;
  wnd.document.removeChild(wnd.document.firstElementChild);
  wnd.document.appendChild(root);

  // Populate with slide state
  loadNotes(stepper, wnd.document.getElementById("notes"));
  loadNowNextThumbnails(
    stepper,
    wnd.document.getElementById("thumbnail-now"),
    wnd.document.getElementById("thumbnail-next"),
  );
  showSlideNumber(
    stepper,
    wnd.document.getElementById("slide-number"),
    wnd.document.getElementById("slide-count"),
  );
  setupStopwatchUI(
    stopwatch,
    wnd.document.getElementById("clock"),
    wnd.document.getElementById("timer"),
    wnd.document.getElementById("timer-pause"),
    wnd.document.getElementById("timer-reset"),
  );
  
  // Forward mouse/keyboard events to main show
  wnd.addEventListener("click", evt => { clickForwardingTarget.dispatchEvent(cloneEvent(evt)); });
  wnd.addEventListener("keydown", evt => { window.dispatchEvent(cloneEvent(evt)); });
  
  // Close the presenter view if we navigate away from this Slidie instance
  window.addEventListener("pagehide", () => wnd.close());
  
  return wnd;
}

/**
 * Make a HTML element resizable by dragging any visible CSS border.
 *
 * NB: Currently only top/right border dragging is supported.
 */
function resizeOnBorderDrag(elem) {
  // Show resize cursor when mouse over borders
  elem.addEventListener("mousemove", evt => {
    if (evt.offsetX - elem.clientWidth >= 0) {
      elem.style.cursor = "ew-resize";
    } else if (evt.offsetY < 0) {
      elem.style.cursor = "ns-resize";
    } else {
      // NB: Bottom/left edges not implemented...
      elem.style.cursor = "auto";
    }
  });
  
  // Implement resizing logic
  elem.addEventListener("mousedown", evt => {
    const style = getComputedStyle(elem);
    
    // Detect which adjustment is being made
    let adjust;
    let scale;
    if (style.borderRightStyle == "solid") {
      if (evt.offsetX - elem.clientWidth < 0) {
        return; // Click not on right border
      }
      adjust = "width";
      scale = 1;
    } else if (style.borderTopStyle == "solid") {
      if (evt.offsetY >= 0) {
        return; // Click not on top border
      }
      adjust = "height";
      scale = -1;
    } else {
      console.warn("Not implemented: Adjusting bottom/left edges!");
    }
    
    evt.preventDefault();
    evt.stopPropagation();
    
    let lastX = evt.clientX;
    let lastY = evt.clientY;
    let width = elem.offsetWidth
    let height = elem.offsetHeight;
    
    // Adjust height/width accordingly
    function onMouseMove(evt) {
      const deltaX = evt.clientX - lastX;
      const deltaY = evt.clientY - lastY;
      lastX = evt.clientX;
      lastY = evt.clientY;
      
      if (adjust == "width") {
        width += deltaX * scale;
        elem.style.width = `${width}px`;
      } else if (adjust == "height") {
        height += deltaY * scale;
        elem.style.height = `${height}px`;
      }
      
      evt.preventDefault();
      evt.stopPropagation();
    }
    function onMouseUp(evt) {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      evt.preventDefault();
      evt.stopPropagation();
    }
    
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseMove);  // Apply final position
    window.addEventListener("mouseup", onMouseUp);
  });
}

/******************************************************************************/

function setup() {
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
  
  // Allow user resizing of thumbnails and notes
  resizeOnBorderDrag(document.getElementById("thumbnails"));
  resizeOnBorderDrag(document.getElementById("notes"));
  
  setupMagicVideoPlayback(slides);
  
  if (slides[0].hasAttributeNS(ns("slidie"), "title")) {
    const title = slides[0].getAttributeNS(ns("slidie"), "title");
    document.title = `${title} - Slidie`;
    document.getElementById("title").innerText = title;
  }
  
  // The main store of state
  const stepper = new Stepper(slides, slideContainers);
  
  // Setup main UI elements
  loadThumbnails(stepper, document.getElementById("thumbnails"));
  loadNotes(stepper, document.getElementById("notes"));
  setupSlideSelector(stepper);
  
  // Create a stopwatch in the main Slidie window even though it is only shown
  // in presenter view so that timings are preserved when the presenter view is
  // closed and reopened.
  const stopwatch = new Stopwatch();
  
  // Presenter view button
  let presenterView = null;
  function showOrFocusPresenterView() {
    if (presenterView !== null && !presenterView.closed) {
      presenterView.focus();
    } else {
      presenterView = showPresenterView(stepper, stopwatch, slidesContainerElem);
    }
  }
  document.getElementById("presenter-view").addEventListener("click", showOrFocusPresenterView);
  
  // Fullscreen button
  function toggleFullScreen() {
    if (document.fullscreenElement === null) {
      stopwatch.resume();  // Automatically start presentation timer
      slidesContainerElem.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
  document.getElementById("full-screen").addEventListener("click", toggleFullScreen);
  
  // Show mouse in full-screen mode when mouse recently moved
  setClassWhileMouseIdle(slidesContainerElem);
  
  // Click to advance by one step
  slidesContainerElem.addEventListener("click", evt => {
    if (!eventInvolvesHyperlink(evt)) {
      stepper.nextStep();
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }
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
      // Left/Down/Space/Enter or Right/Up/Backspace: Move a step at a time
      case "Backspace":
      case "ArrowUp":
      case "ArrowLeft":
        stepper.previousStep();
        break;
      case " ":
      case "Enter":
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
      
      // 'f': Toggle full-screen
      case 'f':
      case 'F':
        toggleFullScreen();
        break;
      
      // 'p': Show presenter view
      case 'p':
      case 'P':
        showOrFocusPresenterView();
        break;
      
      // Other keys: Do nothing.
      default:
        return;
    }
    
    evt.preventDefault();
    evt.stopPropagation();
  });
}

