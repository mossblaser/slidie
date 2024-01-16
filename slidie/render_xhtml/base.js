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
  const svgDocument = svgRoot.ownerDocument;
  const result = svgDocument.evaluate(
      "//svg:*[@slidie:steps]",
      svgRoot,
      ns,
      XPathResult.ORDERED_NODE_ITERATOR_TYPE,
  );
  
  const out = [];
  let elem;
  while ((elem = result.iterateNext())) {
    const steps = JSON.parse(elem.getAttributeNS("http://xmlns.jhnet.co.uk/slidie/1.0", "steps"));
    out.push({ elem, steps });
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
 * A class which steps through a slide show by showing/hiding SVGs and layers
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
    
    // Initially show first slide
    this.curSlide = 0;
    this.curSlideStep = 0;
    this.show(0)
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
    
    this.curSlide = slide;
    this.curSlideStep = step;
    this.blanked = false;
    
    // Show the slide (and hide the others), also turn off any blanking
    for (const [index, container] of this.containers.entries()) {
      container.style.display = index == slide ? "block" : "none";
      
      // If we were blanked, we set visibility to hidden, remove that flag now,
      // if it happens to be set.
      container.style.visibility = "visible";
    }
    
    // Show the appropriate layers for the given build step
    for (const build of this.slideBuilds[slide]) {
      if (build.steps.indexOf(this.slideBuildStepNumbers[slide][step]) >= 0) {
        build.elem.style.display = "block";
      } else {
        build.elem.style.display = "none";
      }
    }
    
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
    
    return this.blanked;
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


/******************************************************************************/

(() => {
  // Find the slides in the document
  const containerElem = document.getElementById("slides");
  const slides = Array.from(containerElem.children);
  
  // Wrap all slides in a Shadow DOM to give them all their own namespaces for
  // IDs etc.
  const containers = slides.map(slide => wrapInShadowDom(slide, "slide-container"));
  
  // Expand SVGs to fill their container (which will be sized and positioned
  // via CSS more conventionally). Only necessary because the SVG element is in
  // a Shadow DOM and thus can't be styled directly
  for (const slide of slides) {
    slide.style.width = "100%";
    slide.style.height = "100%";
  }
  
  const stepper = new Stepper(slides, containers);
    
  // Click to advance by one step
  window.addEventListener("click", evt => {
    stepper.nextStep();
    evt.preventDefault();
    evt.stopPropagation();
    return false;
  });
  
  // Keyboard navigation
  window.addEventListener("keydown", evt => {
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

