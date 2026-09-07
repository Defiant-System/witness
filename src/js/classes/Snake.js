
class Snake {

	constructor(data) {
		// The current path.
		this.snakeId = 1;
		this.start = { i: data.x, j: data.y };
		this.mouse = { x: data.mX, y: data.mY };
		this.movement = [this.start];

		this.MAX_PROGRESS_W = UI.CELL_WIDTH;
		this.MAX_PROGRESS_H = UI.CELL_HEIGHT;
		// this.MAX_PROGRESS_ = Math.min(UI.CELL_WIDTH, UI.CELL_HEIGHT);

		// Symmetry snakes (render-only)
		if (data.symmetry) {
			this.symmetry = data.symmetry;
			this.secondarySnakeId = 2;
			this.secondaryMovement = [this.symmetry.reflectPoint(this.start)];
		} else {
			this.symmetry = null;
			this.secondarySnakeId = null;
			this.secondaryMovement = null;
		}

		// fast references
		this.data = data;

		// SVG elements
		this.snakeEl = null;
		this.secondarySnakeEl = null;

		// Progress through path
		this.target = null;
		this.targetMaxProgress = null;
		this.targetIsEnd = null;
		this.isAtEnd = null;

		// An ongoing path addition or subtraction.
		// Progress is from 0 to MAX_PROGRESS, target == null <=> progress == 0.
		// target cannot be MAX_PROGRESS as steady state (only when about to retract).
		this.progress = 0;

		// The board!
		this.draw = data.draw;

		// Misc state for execution/optimization.
		this.lastUpdateTime = null;
		this.mouseX = data.mX ? data.mX : 0;
		this.mouseY = data.mY ? data.mY : 0;
		this.rawMouseX = this.mouseX;
		this.rawMouseY = this.mouseY;
		this.frameTime = new ElapsedTime();
		this.mouseHistoryX = [];
		this.mouseHistoryY = [];
		this.targetingMouse = false;
		this.snapToGrid = false;
		// Pointer-lock filter: ease toward raw deltas, ignore micro-jitter.
		this.MOUSE_SMOOTH = 1.15;
		this.MOUSE_DEADZONE = 2.5;
		this.MOUSE_HISTORY = 5;
		this.MOUSE_GAIN = 1.5;
	}

	setTargetingMouse(targetingMouse, snapToGrid) {
		this.targetingMouse = targetingMouse;
		this.snapToGrid = snapToGrid;
	}

	atEnd() {
		return this.targetIsEnd && this.progress === this.targetMaxProgress;
	}

	// markSuccessful() {
	// 	if (this.snakeEl) this.snakeEl.addClass("glow");
	// 	if (this.secondarySnakeEl) this.secondarySnakeEl.addClass("glow");
	// }

	setMouseDiff(mouseX, mouseY) {
		this.rawMouseX += mouseX;
		this.rawMouseY += mouseY;
	}

	// Low-pass the virtual cursor toward accumulated pointer-lock motion.
	// Returns true when the snake should step this frame.
	filterMouse() {
		let dx = this.rawMouseX - this.mouseX,
			dy = this.rawMouseY - this.mouseY,
			dist = Math.hypot(dx, dy);
		if (dist <= this.MOUSE_DEADZONE) return false;

		let excess = dist - this.MOUSE_DEADZONE,
			step = excess * this.MOUSE_SMOOTH;
		this.mouseX += (dx / dist) * step;
		this.mouseY += (dy / dist) * step;
		return true;
	}

	pointerDelta() {
		let n = this.mouseHistoryX.length;
		if (n < 2) return { mdx: 0, mdy: 0 };

		let mdx = (this.mouseHistoryX[n - 1] - this.mouseHistoryX[0]) / n * this.MOUSE_GAIN,
			mdy = (this.mouseHistoryY[n - 1] - this.mouseHistoryY[0]) / n * this.MOUSE_GAIN;
		if (Math.abs(mdx) * 5 < Math.abs(mdy)) mdx = 0;
		if (Math.abs(mdy) * 5 < Math.abs(mdx)) mdy = 0;
		return { mdx, mdy };
	}

	calcMouseOnGrid() {
		let gridOnPage = this.grid.offset(),
			mouseOnGrid = {
				x: this.mouseX - gridOnPage.left - UI.MARGIN,
				y: this.mouseY - gridOnPage.top - UI.MARGIN
			};
		return mouseOnGrid;
	}

	moveTowardsMouse(msPerGridUnit, selector) {
		let maxMovement;
		if (this.targetingMouse) {
			let elapsedMs = this.frameTime.step();
			if (elapsedMs == null) return;
			
			let maxMovement_w = Math.floor(elapsedMs / msPerGridUnit * this.MAX_PROGRESS_W / 1.5);
			let maxMovement_h = Math.floor(elapsedMs / msPerGridUnit * this.MAX_PROGRESS_H / 1.5);
			// Simplifying assumption: Max one unit per animation frame, so
			// moveTowardsTarget only needs to be called twice below.
			maxMovement = Math.min(maxMovement_w, maxMovement_h, this.MAX_PROGRESS_W, this.MAX_PROGRESS_H);
		} else {
			this.mouseHistoryX.push(this.mouseX);
			this.mouseHistoryY.push(this.mouseY);
			if (this.mouseHistoryX.length > this.MOUSE_HISTORY) {
				this.mouseHistoryX.shift();
				this.mouseHistoryY.shift();
			}

			// should ideally separate max distance into vertical and horizontal.
			let { mdx, mdy } = this.pointerDelta();
			let move = Math.max(Math.abs(mdx), Math.abs(mdy));
			maxMovement = move;  // Keep it easy...
		}
		let remaining = this.moveTowardsTarget(maxMovement, selector);
		if (remaining != undefined) this.moveTowardsTarget(remaining, selector);
	}

	moveTowardsTarget(maxMovement, selector) {
		let dx = null,
			dy = null,
			params,
			actualMovement;
		
		if (this.targetingMouse) {
			let mouseOnGrid = this.calcMouseOnGrid();
			let pointOnGrid = this.getHead();
			if (!this.snapToGrid) {
				let distanceX = mouseOnGrid.x - Math.round(mouseOnGrid.x / UI.CELL_WIDTH) * UI.CELL_WIDTH;
				let distanceY = mouseOnGrid.y - Math.round(mouseOnGrid.y / UI.CELL_HEIGHT) * UI.CELL_HEIGHT;
				let threshhold = UI.GRID_LINE * 2;
				if (Math.abs(distanceX) <= threshhold && dy >= UI.CELL_WIDTH) {
					mouseOnGrid.x -= distanceX;
				}
				if (Math.abs(distanceY) <= threshhold && dx >= UI.CELL_HEIGHT) {
					mouseOnGrid.y -= distanceY;
				}
			}
			dx = mouseOnGrid.x - pointOnGrid.x;
			dy = mouseOnGrid.y - pointOnGrid.y;
			params = {
				di: Math.sign(dx),
				dj: Math.sign(dy),
				preferHorizontal: Math.abs(dx) >= Math.abs(dy)
			};
		} else {
			let { mdx, mdy } = this.pointerDelta();
			params = {
				di: Math.sign(mdx),
				dj: Math.sign(mdy),
				preferHorizontal: Math.abs(mdx) >= Math.abs(mdy)
			};
		}
		let di = params.di;
		let dj = params.dj;
		if (this.target == null && !this.discoverTarget(selector, params)) return;
		
		let remainingProgress = 0;
		// Want to move towards mouse along axis of concern. Don't initially want to move farther
		// than mouse, and want to figure out next target before moving there.
		// In case where we end up at target, remove target for next time.
		let current = this.movement[this.movement.length - 1];
		let isVertical = current.i == this.target.i;
		let MAX_PROGRESS = isVertical ? this.MAX_PROGRESS_H : this.MAX_PROGRESS_W;
		if (isVertical ? dj == 0 : di == 0) {
			if ((isVertical ? di == 0 : dj == 0) || this.targetIsEnd) return;
			
			// If not targetingMouse, the user may move in a direction we can't go.
			// In that case, we still might be able to move orthogonally, away from
			// the center of the grid line.
			// (Also, don't do this in an end cap, because any slight movement might
			// cause the entire line to get dismissed.)
			if (isVertical) {
				dj = (this.target.j > current.j) == (this.progress >= 50) ? 1 : -1;
				di = 0;
			} else {
				di = (this.target.i > current.i) == (this.progress >= 50) ? 1 : -1;
				dj = 0;
			}
		}

		// We have to do this twice because, if targetingMouse and the user moves
		// in a direction we can't go, we might still be able to realign our movement
		// from vertical to non-vertical, or vice versa, and move orthogonally.
		for (let i = 0; i < 2; i++) {
			let makingProgress = isVertical
					? ((dj > 0) == (this.target.j > current.j))
					: ((di > 0) == (this.target.i > current.i));
			let progressBeforeChangeRequired = Math.max(0, makingProgress
					? (this.progress + maxMovement) - MAX_PROGRESS
					: 0 - (this.progress - maxMovement));
			if (progressBeforeChangeRequired > 0) {
				maxMovement -= progressBeforeChangeRequired;
				remainingProgress += progressBeforeChangeRequired;
			}
			// First, cap by axis. Do this for the absolute value of movement, because
			// the values already agree on direction (we always move in the direction of
			// decreasing delta).
			actualMovement = maxMovement;
			if (dx != null && dy != null) {
				let mpu = isVertical ? this.MAX_PROGRESS_H / UI.CELL_HEIGHT : this.MAX_PROGRESS_W / UI.CELL_WIDTH;
				let maxAxisMovement = Math.abs(Math.floor((isVertical ? dy : dx) * mpu));
				if (maxAxisMovement == 0 && !this.targetIsEnd) {
					// Otherwise, can move orthogonal.
					if (isVertical) {
						dj = (this.target.j > current.j) == (this.progress >= 50) ? 1 : -1;
						di = 0;
					} else {
						di = (this.target.i > current.i) == (this.progress >= 50) ? 1 : -1;
						dj = 0;
					}
					if (dx != null && dy != null) {
						let tmp = dx;
						dx = dy;
						dy = tmp;
					}
					isVertical = !isVertical;
					// Let's try again with new isVertical.
					continue;
				}
				actualMovement = Math.min(actualMovement, maxAxisMovement);
			}
			// Now artifical caps, only if making progress.
			if (makingProgress && this.targetMaxProgress != null) {
				actualMovement = Math.min(actualMovement, this.targetMaxProgress - this.progress);
			}
			this.progress += makingProgress ? actualMovement : -actualMovement;
			break;
		}

		// let isMaxProgress = this.progress === this.targetMaxProgress;
		// if (isMaxProgress && this.isAtEnd !== isMaxProgress) {
		// 	this.isAtEnd = !isMaxProgress;
		// 	console.log( "true" );
		// } else {
		// 	console.log( "false" );
		// }

		// If we were stopped for any reason, we wouldn't be able to reach
		// a target decision.
		if (actualMovement < maxMovement) return;
		
		if (this.progress <= 0) {
			// Backtracked, so forget where we came from.
			this.clearTarget();
			this.progress = MAX_PROGRESS;
			// console.log("Backtrack, target null!");
			if (remainingProgress == 0 || !this.discoverTarget(selector, params)) {
				return;
			}
		} else if (this.progress >= MAX_PROGRESS) {
			// Move forward, so store it.
			if (this.target.i == current.i && this.target.j == current.j) {
				throw Error();
			}
			this.movement.push(this.target);
			if (this.symmetry) {
				this.secondaryMovement.push(this.symmetry.reflectPoint(this.target));
			}
			this.clearTarget();
			this.progress = 0;
			// console.log("Forwards, target null!");
			if (remainingProgress == 0 || !this.discoverTarget(selector, params)) return;
		}

		return remainingProgress;
	}

	clearTarget() {
		this.target = null;
		this.targetMaxProgress = null;
		this.targetIsEnd = false;
	}

	discoverTarget(selector, params) {
		if (this.target != null) return true;

		let current = this.movement[this.movement.length - 1];
		let previous = this.movement.length > 1 ? this.movement[this.movement.length - 2] : null;
		let response = selector.selectTarget(params.di, params.dj, params.preferHorizontal, this.movement, this.secondaryMovement);
		let select = response.select;
		// Allow the case where select is absent or equal to previous value.
		if (!select || (select.i == current.i && select.j == current.j)) return false;
		
		// Otherwise, can only move in one direction at a time.
		if (Math.abs(select.i - current.i) + Math.abs(select.j - current.j) != 1) {
			throw Error("bad prev");
		}
		// And only in the direction of the mouse.
		if ((params.di != 0 && Math.sign(select.i - current.i) == -Math.sign(params.di)) ||
			(params.dj != 0 && Math.sign(select.j - current.j) == -Math.sign(params.dj))) {
			throw Error("too complicated");
		}
		if (previous && (select.i == previous.i && select.j == previous.j)) {
			this.movement.pop();
			if (this.symmetry) this.secondaryMovement.pop();
			
			this.target = current;
			this.targetMaxProgress = null;
			this.progress = params.preferHorizontal ? this.MAX_PROGRESS_W : this.MAX_PROGRESS_H;
		} else {
			if (select.i == current.i && select.j == current.j) throw Error();
			
			this.target = select;
			this.targetMaxProgress = response.maxProgress !== undefined ? response.maxProgress : null;
			this.targetIsEnd = !!response.isEnd;
			this.progress = 0;
		}

		return true;
	}

	getHead() {
		let lastTarget = this.movement[this.movement.length - 1];
		let x = lastTarget.i * UI.CELL_WIDTH;
		let y = lastTarget.j * UI.CELL_HEIGHT;
		if (this.target) {
			x += (this.progress * UI.CELL_WIDTH / this.MAX_PROGRESS_W) * (this.target.i - lastTarget.i);
			y += (this.progress * UI.CELL_HEIGHT / this.MAX_PROGRESS_H) * (this.target.j - lastTarget.j);
		}
		return { x, y };
	}

	getRenderContents(movement, target) {
		// Initial output: start, direction. If last one, also include progress.
		// In the future, add arcs.
		let contents = [];
		let previous = null;
		let current = movement[movement.length-1];
		let entity = this.data.grid.getEntity(current.i, current.j);

		for (let i = 0; i <= movement.length; i++) {
			let isEnd = i == movement.length;
			if (isEnd && !target) continue;
			
			let coords = isEnd ? target : movement[i];
			let segment = { i: coords.i, j: coords.j };
			if (!previous) {
				segment.segmentType = SegmentType.START;
			} else {
				if (isEnd) segment.rotation = entity.rotation;
				segment.segmentType = isEnd ? SegmentType.END : SegmentType.MIDDLE;
				segment.direction = coords.i == previous.i ? DrawType.VLINE : DrawType.HLINE;
				// compass direction
				if (segment.direction == DrawType.VLINE) segment.dir = coords.j < previous.j ? Compass.NORTH : Compass.SOUTH;
				else segment.dir = coords.i < previous.i ? Compass.EAST : Compass.WEST;
				if (isEnd && this.progress > 0) {
					let movingDownOrRight = coords.i > previous.i || coords.j > previous.j;
					let max_progress = segment.direction == DrawType.VLINE ? this.MAX_PROGRESS_H : this.MAX_PROGRESS_W;
					max_progress -= UI.GRID_LINE - 19;
					// The offset to start/end of line.
					segment.start = movingDownOrRight ? 0 : max_progress - this.progress;
					segment.end = movingDownOrRight ? max_progress - this.progress : 0;
				}
				segment.i = Math.min(coords.i, previous.i);
				segment.j = Math.min(coords.j, previous.j);
			}
			contents.push(segment);
			previous = coords;
		}
		return contents;
	}

	anythingChanged() {
		// hash code avoid constantly rendering.
		let current = this.movement[this.movement.length - 1],
			change = (current.i * 16 * 16 + current.j * 16 + this.movement.length) * this.progress + this.progress;
		if (this.lastChange == null || this.lastChange != change) {
			this.lastChange = change;
			return true;
		} else {
			return false;
		}
	}

	render() {
		if (!this.anythingChanged()) return;

		let contents = this.getRenderContents(this.movement, this.target);
		this.snakeEl = this.renderSingle(contents, this.snakeId, this.snakeEl);

		if (this.symmetry) {
			let symTarget = this.target ? this.symmetry.reflectPoint(this.target) : null;
			contents = this.getRenderContents(this.secondaryMovement, symTarget);
			this.secondarySnakeEl = this.renderSingle(contents, this.secondarySnakeId, this.secondarySnakeEl);
		}
	}

	renderSingle(contents, snakeId, snakeEl) {
		// Ugly DOM manipulation to insert SVG dynamically.
		if (!snakeEl) {
			snakeEl = document.createElementNS("http://www.w3.org/2000/svg", "g")
			snakeEl.setAttribute("class", `path${snakeId}`);
			this.draw.append(snakeEl);
		}
		this.renderSvg(snakeEl, contents);

		return snakeEl;
	}

	renderSvg(el, contents) {
		let out = contents.map(segment => {
			let x = segment.i * UI.CELL_WIDTH,
				y = segment.j * UI.CELL_HEIGHT,
				direction = segment.direction,
				start = segment.start || 0,
				end = segment.end || 0,
				horizontal = direction == DrawType.HLINE ? 1 : 0,
				vertical = 1 - horizontal,
				soff = start ? start : 0,
				eoff = end ? end : 0,
				partial = start || end ? 1 : 0,
				x1 = x + horizontal * partial * soff,
				y1 = y + vertical * partial * soff,
				x2 = x + horizontal * (UI.CELL_WIDTH - partial * eoff),
				y2 = y + vertical * (UI.CELL_HEIGHT - partial * eoff),
				str = "";

			// console.log( segment );
			switch (segment.segmentType) {
				case SegmentType.UNKNOWN:
					break;
				case SegmentType.START:
					str = `<circle cx="${x1}" cy="${y1}" r="${UI.START_R}" />`;
					break;
				case SegmentType.MIDDLE:
					str = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${UI.GRID_LINE+1}" stroke-linecap="round"></line>`;
					break;
				case SegmentType.END:
					let rot = "";
					// console.log( ["NORTH", "WEST", "SOUTH", "EAST"][segment.dir] );
					switch (true) {
						case (segment.rotation == 1 && segment.dir === Compass.WEST):
							rot = `transform="translate(${x1-x2} ${y1-y2}) rotate(135 ${x2} ${y2})"`;
							break;
						case (segment.rotation == 3 && segment.dir === Compass.WEST):
							rot = `transform="translate(${x1-x2} ${y1-y2}) rotate(225 ${x2} ${y2})"`;
							break;
						case (segment.rotation == 5 && segment.dir === Compass.EAST):
							rot = `transform="rotate(-45 ${x2} ${y2})"`;
							break;
						case (segment.rotation == 7 && segment.dir === Compass.EAST):
							rot = `transform="rotate(45 ${x2} ${y2})"`;
							break;
					}
					str = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${rot} stroke-width="${UI.GRID_LINE+1}" stroke-linecap="round"></line>`;
					break;
			}
			return str;
		});

		// insert svg "elements"
		$(el).html(out.join(""));
	}

	// stringRepr() {}
	// fadeSingle(snakeEl, opt_timeout, opt_callback) {}
	// fade(opt_timeout, opt_callback) {}

}
