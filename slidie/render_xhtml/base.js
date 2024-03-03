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
    for (const tag of tags) {
      if (!map.has(tag)) {
        map.set(tag, []);
      }
      for (const stepNumber of steps){
        map.get(tag).push(stepNumbers.indexOf(stepNumber));
      }
      map.get(tag).sort();
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
 * * tags -- an array of any tags assigned to currently visible build steps.
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
    
    this.tags = [];
    const buildStepTags = stepper.slideBuildStepTags[this.slide];
    for (const [tag, steps] of buildStepTags.entries()) {
      if (steps.indexOf(this.step) >= 0) {
        this.tags.push(tag);
      }
    }
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
 * @param slideBuildStepTags An array of Map() from tag to an array of step
 *        indices, one per slide.
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
        step = slideBuildStepTags[slide].get(tag)[0];
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
 * Return the DOMMatrix which represents the Current Transform Matrix (from the
 * object's coordinate system to the top level user units (i.e. within the
 * viewBox, not on the screen)).
 *
 * By contrast with the built-in getCTM() method, this function uses only the
 * transforms statically declared in the SVG meaning it can be used on
 * non-displayed SVGs.  This does mean that the matrix returned does not
 * account for other (e.g. CSS-applied) transforms.
 */
function getSvgStaticCTM(elem) {
    // Get the parents in root-to-leaf order
    const parents = [elem];
    while (parents[0].parentElement) {
      parents.splice(0, 0, parents[0].parentElement);
    }
    // Drop the top level 'svg' element since its transform matrix applies to
    // the final SVG canvas, not to elements within it.
    parents.splice(0, 1);
    
    // Assemble the DOMMatrix
    const ctm = new DOMMatrix();
    for (const elem of parents) {
      for (const transform of elem.transform.baseVal) {
        ctm.multiplySelf(transform.matrix);
      }
    }
    return ctm;
}

/**
 * Return the size of user units in an SVG in pixels in the X and Y axes
 * (respectively) in a 2-element array.
 */
function getSvgUserUnitSize(svg) {
  if (svg.viewBox.baseVal === null) {
    // Special case: viewBox not defined, the SVG is rendered with one user
    // unit per pixel
    return [1, 1];
  }
  
  const svgWidth = svg.width.baseVal.value;
  const svgHeight = svg.height.baseVal.value;
  
  const svgVBWidth = svg.viewBox.baseVal.width;
  const svgVBHeight = svg.viewBox.baseVal.height;
  
  const hScale = svgWidth / svgVBWidth;
  const vScale = svgHeight / svgVBHeight;
  
  const par = svg.preserveAspectRatio.baseVal
  if (par.align === SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE) {
    // Case: Uniform scaling not used so whatever distorted aspect ratio we
    // happen to have is what we'll get
    return [hScale, vScale];
  } else {
    // Case: Uniform scaling used.
    const viewBoxWiderThanSVG = (svgVBWidth / svgVBHeight) > (svgWidth / svgHeight);
    const meet = par.meet === SVGPreserveAspectRatio.SVG_MEETORSLICE_MEET;
    if (meet == viewBoxWiderThanSVG) {
      return [hScale, hScale];
    } else {
      return [vScale, vScale];
    }
  }
}

/**
 * Return the width and height, in SVG pixels, of the provided element after
 * all relevant transform matrices have been applied.
 */
function getSvgElementSizePx(elem) {
  const ctm = getSvgStaticCTM(elem);
  
  const [sx, sy] = getSvgUserUnitSize(elem.ownerSVGElement);
  ctm.scaleSelf(sx, sy);
  
  const topLeft = ctm.transformPoint(new DOMPoint(
    elem.x.baseVal.value,
    elem.y.baseVal.value,
  ));
  const topRight = ctm.transformPoint(new DOMPoint(
    elem.x.baseVal.value + elem.width.baseVal.value,
    elem.y.baseVal.value,
  ));
  const bottomLeft = ctm.transformPoint(new DOMPoint(
    elem.x.baseVal.value,
    elem.y.baseVal.value + elem.height.baseVal.value,
  ));
  
  const dxW = topRight.x - topLeft.x;
  const dyW = topRight.y - topLeft.y;
  const width = Math.sqrt(dxW*dxW + dyW*dyW);
  
  const dxH = bottomLeft.x - topLeft.x;
  const dyH = bottomLeft.y - topLeft.y;
  const height = Math.sqrt(dxH*dxH + dyH*dyH);
  
  return [width, height];
}

/**
 * Scale all <foreignObject> elements' contents according to the "native" size
 * of the SVG. That is, if the SVG is viewed at native size, the
 * <foreignObject> contents will be shown at native size too (regardless of any
 * scaling applied to the <foreignObject> element).
 *
 * An optional scaling factor indicated by the slidie:scale attribute on the
 * <foreignObject> may be used to enlarge (or shrink) the contents by a
 * specified amount.
 */
function setupForeignObjectScaling(svg) {
  for (const foreignObject of svg.getElementsByTagNameNS(ns("svg"), "foreignObject")) {
    // The size of pixels within a <foreignObject> is determined by its width and
    // height attributes. This means that if we have an <iframe> in a
    // <foreignObject> with a width of 300 and height of 200, the iframe will
    // be rendered as if on a 300x200 pixel display.
    //
    // Unfortunately, the width/height of a <foreignObject> is ordinarily given
    // with reference to the local coordinate system potentially under the
    // effect of some artbirary transformation matrix. This usually results in
    // entirely unpredictable rendering sizes.
    //
    // To work around this we can set the width/height attributes to the
    // desired size in pixels and then add a scale transform to resize the
    // elemnt back to its original size.
    
    // First we'll grab the actual size in pixels of the element after all
    // transforms are applied.
    const [widthPx, heightPx] = getSvgElementSizePx(foreignObject);
    
    // Next we'll adjust this to achieve the scaling factor requested by the
    // slidie:scale attribute
    const scale = parseFloat(foreignObject.getAttributeNS(ns("slidie"), "scale") || "1");
    const width = widthPx / scale;
    const height = heightPx / scale;
    
    // Next we'll set the size attributes of the <foreignObject> to its size in
    // pixels so that its contents are rendered at "native" size
    const widthOrig = foreignObject.getAttribute("width");
    const heightOrig = foreignObject.getAttribute("height");
    foreignObject.setAttribute("width", width);
    foreignObject.setAttribute("height", height);
    
    // Compute the corrective scale factor to restore the intended size of the
    // <foreignObject>
    const sx = widthOrig / width;
    const sy = heightOrig / height;
    
    // We'll also need to move any x and y attributes into a translate
    // transform which happens prior to scaling to avoid needing to scale these
    // too.
    const x = parseFloat(foreignObject.getAttribute("x") || "0");
    const y = parseFloat(foreignObject.getAttribute("y") || "0");
    foreignObject.removeAttribute("x");
    foreignObject.removeAttribute("y");
    
    // Finally apply the corrective transform
    const existingTransform = foreignObject.getAttribute("transform") || "";
    foreignObject.setAttribute(
      "transform",
      `${existingTransform} translate(${x}, ${y}) scale(${sx}, ${sy})`
    )
  }
}

/**
 * Enable links to target named <iframes> within a <foreignObject> in the same
 * slide.
 *
 * Ordinarily, this is not supported so we must emulate this behaviour within
 * Javascript.
 */
function setupIFrameLinkTargetSupport(svg) {
  // Find all iframes on the slide
  const iframes = new Map();
  for (const iframe of svg.getElementsByTagNameNS(ns("xhtml"), "iframe")) {
    const name = iframe.getAttribute("name");
    if (name) {
      iframes.set(name, iframe);
    }
  }
  
  // Add special handlers for links
  for (const link of svg.getElementsByTagNameNS(ns("svg"), "a")) {
    link.addEventListener("click", evt => {
      const href = link.getAttributeNS(ns("xlink"), "href") || link.getAttribute("href");
      const iframe = iframes.get(link.getAttribute("target"));
      if (iframe) {
        iframe.contentWindow.location = href;
        evt.preventDefault();
      }
    });
  }
}

/**
 * Given an SVG element, returns a {stepNumbers, tags} for the build steps of
 * the nearest parent element with build steps specified. If no parent has any
 * build steps specified, returns null.
 */
function findElementBuildSteps(elem) {
  while (elem) {
    if (elem.namespaceURI == ns("svg") && elem.hasAttributeNS(ns("slidie"), "steps")) {
      const stepNumbers = JSON.parse(elem.getAttributeNS(ns("slidie"), "steps"));
      const tags = JSON.parse(elem.getAttributeNS(ns("slidie"), "tags") || "[]");
      return {stepNumbers, tags};
    }
    elem = elem.parentElement;
  }
  return null;
}

/**
 * Forward slide/step changing events to iframes via their postMessage
 * mechanism.
 *
 * Whilst the slide the iframe resides on is visible, or upon leaving it,
 * messages of the following form are sent:
 *
 *      {
 *        visible: <bool>,
 *        step: <int or null>,
 *        stepNumber: <int or null>,
 *        tags: <list[str] or null>,
 *      }
 *
 * The 'visible' attribute indicates the visibility of the iframe. The step and
 * stepNumber indicate the current step (regardless of whether the iframe is
 * visible or not).
 */
function setupIFrameSlideEvents(svg) {
  for (const iframe of svg.getElementsByTagNameNS(ns("xhtml"), "iframe")) {
    svg.addEventListener("stepchange", evt => {
      const iframeBuildSteps = findElementBuildSteps(iframe);
      const visible = (
        iframeBuildSteps
          ? iframeBuildSteps.stepNumbers.indexOf(evt.stepNumber) >= 0
          : true
      );
      iframe.contentWindow.postMessage({
        visible,
        step: evt.step,
        stepNumber: evt.stepNumber,
        tags: evt.tags,
      });
    });
    svg.addEventListener("slideexit", evt => {
      iframe.contentWindow.postMessage({
        visible: false,
        step: null,
        stepNumber: null,
        tags: null,
      });
    });
  }
}

/**
 * Setup automatic video play/pause on slide entry/exit for videos inserted
 * using magic text.
 */
function setupMagicVideoPlayback(slide) {
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
 * Given a keydown event, test whether handling this event may interfere with
 * keyboard operation of a <button> or hyperlink.
 */
function keyboardEventInterferesWithHyperlink(evt) {
  switch (evt.key) {
    case "Enter":
    case "Space":
      return eventInvolvesHyperlink(evt);
    
    default:
      return false;
  }
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
  
  // Display clock/stopwatch
  setupStopwatchUI(
    stopwatch,
    wnd.document.getElementById("clock"),
    wnd.document.getElementById("timer"),
    wnd.document.getElementById("timer-pause"),
    wnd.document.getElementById("timer-reset"),
  );
  
  // Populate help screen
  const helpDialog = document.getElementById("help").cloneNode(true);
  helpDialog.close();  // Incase it is already open
  wnd.document.body.appendChild(helpDialog);
  
  // Forward mouse/keyboard events to main show
  wnd.addEventListener("click", evt => { clickForwardingTarget.dispatchEvent(cloneEvent(evt)); });
  wnd.addEventListener("keydown", evt => {
    // ...except handle the shortcut to show help locally since we will want to
    // show that in presenter view!
    if (keyboardEventInterferesWithHyperlink(evt)) {
      return;
    }
    if (evt.key == "F1" || evt.key == "?") {
      toggleModalDialog(helpDialog);
      evt.preventDefault();
      evt.stopPropagation();
    } else {
      window.dispatchEvent(cloneEvent(evt));
    }
  });
  
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

/**
 * Given a keyboard event and an array of objects with a 'keys' value, returns
 * the first object whose 'keys' value contains the pressed key. Returns null
 * if no key matches.
 *
 * Keys should be an array of key names (e.g. "PageDown" or "X"). When
 * individual letters are specified, both lower- and upper-case versions will
 * be matched.
 */
function matchKeypress(evt, shortcuts) {
  // For now we don't support matching on modifiers so just check none are
  // pressed. (NB: We ignore shift as a special case.)
  if (evt.altKey || evt.ctrlKey || evt.metaKey) {
    return null;
  }
  
  for (const entry of shortcuts) {
    for (const key of entry.keys) {
      if (key.match(/^[a-zA-Z]$/) !== null) {
        // Special case: Case-insensitive comparison of single letter keys
        if (key.toLowerCase() == evt.key.toLowerCase()) {
          return entry;
        }
      } else if (key == evt.key) {
        return entry;
      }
    }
  }
  return null;
}

const keyboardKeysToSymbols = new Map([
  ["ArrowLeft", "\u2190"],
  ["ArrowUp", "\u2191"],
  ["ArrowRight", "\u2192"],
  ["ArrowDown", "\u2193"],
  ["Backspace", "\u232B"],
  ["Enter", "\u23CE"],
]);


/**
 * Populate the help dialog with the available keyboard shortcuts.
 */
function populateKeyboardHelp(shortcuts) {
  const container = document.getElementById("help-keyboard-shortcuts");
  for (const {keys, description} of shortcuts) {
    
    const keysElem = document.createElementNS(ns("xhtml"), "dt");
    for (const [i, key] of keys.entries()) {
      if (i > 0) {
        keysElem.append(" or ");
      }
      const kbd = document.createElementNS(ns("xhtml"), "kbd");
      if (keyboardKeysToSymbols.has(key)) {
        kbd.innerText = keyboardKeysToSymbols.get(key);
      } else {
        kbd.innerText = key;
      }
      keysElem.append(kbd);
    }
    
    const descriptionElem = document.createElementNS(ns("xhtml"), "dd");
    descriptionElem.innerText = description;
    
    container.append(keysElem, descriptionElem);
  }
}

/** Toggles the open state of a <dialog> element */
function toggleModalDialog(dialog) {
  if (dialog.open) {
    dialog.close();
  } else {
    dialog.showModal();
    dialog.focus();
  }
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
  
  slides.map(setupForeignObjectScaling);
  slides.map(setupIFrameLinkTargetSupport);
  slides.map(setupIFrameSlideEvents);
  slides.map(setupMagicVideoPlayback);
  
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
  
  // Help button
  const helpDialog = document.getElementById("help");
  document.getElementById("show-help").addEventListener("click", () => {
    toggleModalDialog(helpDialog)
  });
  
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
  
  // Handle keyboard navigation
  const keyboardShortcuts = [
    {
      description: "Next step/slide",
      keys: ["Backspace", "ArrowUp", "ArrowLeft", "K"],
      action: () => stepper.previousStep(),
    },
    {
      description: "Previous step/slide",
      keys: ["Enter", "ArrowDown", "ArrowRight", "J"],
      action: () => stepper.nextStep(),
    },
    {
      description: "Jump to previous slide (skip build steps)",
      keys: ["PageUp"],
      action: () => stepper.previousSlide(),
    },
    {
      description: "Jump to next slide (skip build steps)",
      keys: ["PageDown"],
      action: () => stepper.nextSlide(),
    },
    {
      description: "Jump to start",
      keys: ["Home"],
      action: () => stepper.start(),
    },
    {
      description: "Jump to end",
      keys: ["End"],
      action: () => stepper.end(),
    },
    {
      description: "Black screen",
      keys: ["Z", "B", "."],
      action: () => stepper.toggleBlank(),
    },
    {
      description: "Toggle full screen",
      keys: ["F"],
      action: () => toggleFullScreen(),
    },
    {
      description: "Open presenter view",
      keys: ["P"],
      action: () => showOrFocusPresenterView(),
    },
    {
      description: "Show help",
      keys: ["F1", "?"],
      action: () => toggleModalDialog(helpDialog),
    },
  ];
  
  populateKeyboardHelp(keyboardShortcuts);
  
  window.addEventListener("keydown", evt => {
    if (keyboardEventInterferesWithHyperlink(evt)) {
      return;
    }
    
    const match = matchKeypress(evt, keyboardShortcuts);
    if (match !== null) {
      match.action();
      evt.preventDefault();
      evt.stopPropagation();
    }
  });
}

