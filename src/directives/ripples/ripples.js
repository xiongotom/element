const DELAY_RIPPLE = 80;


function transform (el, value) {
  el.style.transform = value;
  el.style.webkitTransform = value;
}

function opacity (el, value) {
  el.style.opacity = value.toString();
}

function isToucheEvent(e) {
  return e.constructor.name === 'TouceEvent';
}

function isKeybordEvent(e) {
  return e.constructor.name === 'KeyboardEvent';
}

function isRippleEnabled(value) {
  return typeof value === 'undefined' || !!value;
}

const calculate = function(e, el, options) {
  let localX = 0;
  let localY = 0;

  if(!isKeybordEvent(e)) {
    const offset = el.getBoundingClientRect();
    const target = isToucheEvent(e) ? e.touches[e.touches.length - 1] : e;

    localX = target.clientX - offset.left;
    localY = target.clientY - offset.top;
  }

  let radius = 0;
  let scale = 0.3;
  if (el._ripple && el._ripple.circle) {
    scale = 0.15;
    radius = el.clientWidth / 2;
    radius = options.center ? radius : radius + Math.sqrt((localX - radius)*(localX - radius) + (localY - radius)*(localY - radius)) / 4;
  } else {
    radius = Math.sqrt(el.clientWidth * el.clientWidth + el.clientHeight * el.clientHeight) / 2;
  }

  const centerX = `${(el.clientWidth - (radius * 2)) / 2}px`;
  const centerY = `${(el.clientHeight - (radius * 2)) / 2}px`;

  const x = options.center ? centerX : `${localX - radius}px`;
  const y = options.center ? centerY : `${localY - radius}px`;

  return { radius, scale, x, y, centerX, centerY };
}

const ripplesHelper = {
  show(e, el, options) {
    if(!el._ripple || !el._ripple.enabled) {
      return;
    }

    const container = document.createElement('span');
    const animation = document.createElement('span');

    container.append(animation);
    container.className = 'hg-ripple__container';

    if (options.class) {
      container.className += ` ${options.class}`
    }

    const { radius, scale, x, y, centerX, centerY } = calculate(e, el, options)
    const size = `${radius * 2}px`
    animation.className = 'hg-ripple__animation'
    animation.style.width = size
    animation.style.height = size

    el.appendChild(container)

    const computed = window.getComputedStyle(el)
    if(computed && computed.position === 'static') {
      el.style.position = 'relative'
      el.dataset.previousPosition = 'static'
    }

    animation.classList.add('hg-ripple__animation--enter')
    animation.classList.add('hg-ripple__animation--visible')
    transform(animation, `translate(${x}, ${y}) scale3d(${scale}, ${scale}, ${scale})`)
    opacity(animation, 0)
    animation.dataset.activated = String(performance.now())

    setTimeout(() => {
      animation.classList.remove('hg-ripple__animation--enter')
      animation.classList.add('hg-ripple__animation--in')
      transform(animation, `translate(${centerX}, ${centerY}) scale3d(1, 1, 1)`)
      opacity(animation, 0.25)
    }, 0)
  },
  hide(el) {
    if(!el || !el._ripple || !el._ripple.enabled) return

    const ripples = el.getElementsByClassName('hg-ripple__animation')

    if(ripples.length === 0) return
    const animation = ripples[ripples.length - 1]

    if(animation.dataset.isHiding) return
    else animation.dataset.isHiding = 'true'

    const diff = performance.now() - Number(animation.dataset.activated)
    const delay = Math.max(250 - diff, 0)

    setTimeout(() => {
      animation.classList.remove('hg-ripple__animation--in')
      animation.classList.add('hg-ripple__animation--out')
      opacity(animation, 0)

      setTimeout(() => {
       const ripples = el.getElementsByClassName('hg-ripple__animation') 
       if(ripples.length === 1 && el.dataset.previousPosition) {
         el.style.position = el.dataset.previousPosition
         delete el.dataset.previousPosition
       }

       animation.parentNode && el.removeChild(animation.parentNode)
      }, 300);
    }, delay)
  }
}

/**
 * 显示波纹
 * @param {Mousevent | TouchEvent} e 
 */
const rippleShow = function(e) {
  const options = Object.create(null)
  const element = e.currentTarget
  if(!element || !element._ripple || element._ripple.touched) return
  if(isToucheEvent(e)) {
    element._ripple.touched = true
    element._ripple.isTouch = true
  } else if(element._ripple.isTouch) {
    // It's possible for touch events to fire
    // as mouse events on Android/iOS, this
    // will skip the event call if it has
    // already been registered as touch
    return
  }
  options.center = element._ripple.centered || isKeybordEvent(e)
  if(element._ripple.class) {
    options.class = element._ripple.class
  }

  if(isToucheEvent(e)) {
    if(element._ripple.showTimerCommit) return

    element._ripple.showTimerCommit = () => {
      ripplesHelper.show(e, element, options)
    }
    element._ripple.showTimer = setTimeout(() => {
      if(element && element._ripple && element._ripple.showTimerCommit) {
        element._ripple.showTimerCommit()
        element._ripple.showTimerCommit = null
      }
    }, DELAY_RIPPLE)
  } else {
    ripplesHelper.show(e, element, options)
  }
}

const rippleHide = function(e) {
  const element = e.currentTarget
  if(!element || !element._ripple) return

  clearTimeout(element._ripple.showTimer)

  if(e.type === 'touchend' && element._ripple.showTimerCommit) {
    element._ripple.showTimerCommit()
    element._ripple.showTimerCommit = null

    element._ripple.showTimer = setTimeout(() => {
      rippleHide(e)
    })
    return
  }

  setTimeout(() => {
    if(element._ripple) {
      element._ripple.touched = false
    }
  })
  ripplesHelper.hide(element)
}

const rippleCancelShow = function(e) {
  const element = e.currentTarget
  if(!element || !element._ripple) return

  if(element._ripple.showTimerCommit) {
    element._ripple.showTimerCommit = null
  }

  clearTimeout(element._ripple.showTimer)
}

let keyboardRipple = false

const keyboardRippleShow = function(e) {
  if(!keyboardRipple && (e.keyCode === 32 || e.keyCode === 13)) {
    // key code is enter or space
    keyboardRipple = true
    rippleShow(e)
  }
}

const keyboardRippleHide = function(e) {
  keyboardRipple = false
  rippleHide(e)
}

const updateRipple = function(el, binding, wasEnabled) {
  const enabled = isRippleEnabled(binding.value)
  if(!enabled) {
    ripplesHelper.hide(el)
  }
  el._ripple = el._ripple || Object.create(null)
  el._ripple.enabled = enabled
  const options = binding.value || Object.create(null)
  if(options.center) {
    el._ripple.centered = true
  }
  if(options.class) {
    el._ripple.class = options.value.class
  }
  if(options.circle) {
    el._ripple.circle = options.circle
  }
  if (enabled && !wasEnabled) {
    el.addEventListener('touchstart', rippleShow, { passive: true })
    el.addEventListener('touchend', rippleHide, { passive: true })
    el.addEventListener('toucemove', rippleCancelShow, { passive: true })
    el.addEventListener('touchcancel', rippleHide)

    el.addEventListener('mousedown', rippleShow)
    el.addEventListener('mouseup', rippleHide)
    el.addEventListener('mouseleave', rippleHide)

    el.addEventListener('keydown', keyboardRippleShow)
    el.addEventListener('keyup', keyboardRippleHide)

    el.addEventListener('dragstart', rippleHide, { passive: true })
  } else if (!enabled && wasEnabled) {
    removeListeners(el) 
  }
}

const removeListeners = function(el) {
  el.removeEventListener('mousedown', rippleShow)
  el.removeEventListener('touchstart', rippleShow)
  el.removeEventListener('touchend', rippleHide)
  el.removeEventListener('touchmove', rippleCancelShow)
  el.removeEventListener('touchcancel', rippleHide)
  el.removeEventListener('mouseup', rippleHide)
  el.removeEventListener('mouseleave', rippleHide)
  el.removeEventListener('keydown', keyboardRippleShow)
  el.removeEventListener('keyup', keyboardRippleHide)
  el.removeEventListener('dragstart', rippleHide)
}

function directive(el, binding, node) {
  updateRipple(el, binding, false)
}

function unbind(el) {
  delete el._ripple 
  removeListeners(el)
}

function update(el, binding) {
  if(binding.value === binding.oldValue) {
    return
  }
  const wasEnabled = isRippleEnabled(binding.oldValue)
  updateRipple(el, binding, wasEnabled)
}


export default {
  bind: directive,
  unbind,
  update
}

