// Keyboard and mouse for Neon Bay. Held keys are read every frame; one-shot
// presses are queued and taken once, so a tap between two frames is never lost
// and never counted twice. The mouse position is kept in screen pixels and
// converted to world pixels by the renderer (the camera owns that maths).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();       // currently held, by event.code
    this.pressed = new Set();    // pressed since the last endFrame()
    this.mouse = { x: 0, y: 0, down: false, clicked: false, moved: false };
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => { this.keys.clear(); this.mouse.down = false; };
    this._onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.moved = true;
    };
    this._onDown = (e) => {
      e.preventDefault();
      this._onMove(e);
      this.mouse.down = true;
      this.mouse.clicked = true;
    };
    this._onUp = () => { this.mouse.down = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMove);
    canvas.addEventListener('mousedown', this._onDown);
    window.addEventListener('mouseup', this._onUp);
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  // Drop a one-shot press so the same tap cannot fire twice in one frame
  // (pause-then-resume on a single Escape, for example).
  consume(code) { this.pressed.delete(code); }

  // WASD or arrows as a -1..1 pair, for walking and for steering.
  moveAxis() {
    const x = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0)
            - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const y = (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0)
            - (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  // True while the frame's click is still unclaimed (menus take it first).
  takeClick() {
    if (!this.mouse.clicked) return null;
    this.mouse.clicked = false;
    return { x: this.mouse.x, y: this.mouse.y };
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.moved = false;
  }
}
