
class Grid {
	constructor() {
		// sub objects
		this.navigationSelector = new NavigationSelector(this);
	}

	async render(id) {
		// save value
		this.levelId = id;
		// out with the old
		window.find(".game-view .level").cssSequence("disappear", "animationend", el => el.remove());

		// remove potential clones
		window.bluePrint.selectNodes(`//Level[@clone]`).map(xClone => xClone.parentNode.removeChild(xClone));

		// prepare xml, template & units
		let match = `//Data/Level[@id="${id}"]`;
		let xLevel = window.bluePrint.selectSingleNode(match);
		let xGrid = xLevel.selectSingleNode("./grid");
		// values from xLevel to UI contants
		this.syncConstants(xGrid);
		// make sure particles are reset
		Particles.reset();
		// generate storage entities, etc
		this.generateStorage(xLevel);

		// html output
		let nextEl = await window.render({
			match,
			template: "level-puzzle",
			append: window.find(".game-view"),
		});

		let appearFn = () => {
			// appear animation
			nextEl.cssSequence("appear", "animationend", el => el.addClass("active").removeClass("appear"));
		};

		if (id === "1.0") setTimeout(appearFn, 500);
		else appearFn();
		
		// center puzzle
		this.el = nextEl.find(".puzzle");
		let top = (window.innerHeight - +this.el.prop("offsetHeight")) >> 1,
			left = (window.innerWidth - +this.el.prop("offsetWidth")) >> 1;
		this.el.css({ top, left });

		let base = window.bluePrint.selectSingleNode(`//Palette[@id="${xLevel.getAttribute("palette")}"]/c[@key="base"]`),
			show = id === "0.1" ? "start-view" : "game-view";
		window.find("content").data({ show }).css({ "--base": base.getAttribute("val") });
		// broadcast event
		window.emit("render-level", { id });
	}

	async renderClone(xClone) {
		let xGrid = xClone.selectSingleNode("./grid");
		// values from xLevel to UI contants
		this.syncConstants(xGrid);
		// make sure particles are reset
		Particles.reset();
		// generate storage entities, etc
		this.generateStorage(xClone);

		// html output
		let match = `//Data/Level[@clone="${xClone.getAttribute("clone")}"]`;
		let cloneEl = await window.render({ match, template: "level-puzzle", vdom: true }).find(".level");
		cloneEl.removeClass("appear").addClass("active");
		this.el.parent().replace(cloneEl[0]);

		// center puzzle
		this.el = cloneEl.find(".puzzle");
		let top = (window.innerHeight - +this.el.prop("offsetHeight")) >> 1,
			left = (window.innerWidth - +this.el.prop("offsetWidth")) >> 1;
		this.el.css({ top, left });
	}

	syncConstants(xGrid) {
		// default units
		let Defaults = [
				{ x: "grid", ui: "GRID_UNIT", val: 83 },
				{ x: "line", ui: "GRID_LINE", val: 19 },
				{ x: "gW", ui: "CELL_WIDTH", val: 83 },
				{ x: "gH", ui: "CELL_HEIGHT", val: 83 },
				{ x: "gap", ui: "DISJOINT_LENGTH", val: 22 },
				{ x: "error", ui: "ERROR_COLOR", val: "#ff0000" },
			];
		
		// "gW" & "gH" is omitted but "grid" is set
		if (xGrid.getAttribute("grid") && !xGrid.getAttribute("gW")) xGrid.setAttribute("gW", xGrid.getAttribute("grid"));
		if (xGrid.getAttribute("grid") && !xGrid.getAttribute("gH")) xGrid.setAttribute("gH", xGrid.getAttribute("grid"));

		// sync level values with defaults / UI units
		Defaults.map(item => {
			if (xGrid.getAttribute(item.x)) {
				UI[item.ui] = +xGrid.getAttribute(item.x);
			} else {
				UI[item.ui] = item.val;
				xGrid.setAttribute(item.x, item.val);
			}
		});
		// use only "gW" & "gH"
		xGrid.removeAttribute("grid");
		// adapt start radius to line width
		UI.START_R = (UI.GRID_LINE * 2.5) / 2;
		// double disjoint gap
		UI.DISJOINT_H = (UI.CELL_HEIGHT - UI.GRID_LINE - UI.DISJOINT_LENGTH) / 2;
		UI.DISJOINT_W = (UI.CELL_WIDTH - UI.GRID_LINE - UI.DISJOINT_LENGTH) / 2;
	}

	initializeSnake(data) {
		data.grid = this;
		data.gridEl = this.el;
		data.draw = this.el.find(".grid-path svg g");
		data.symmetry = this.getSymmetry();
		this.snake = new Snake(data);

		this.snake.setTargetingMouse(true);
		this.snake.render();

		// sound fx
		window.audio.play("start");

		// UI update
		this.el.addClass("snake-active");

		// enables a nice "grow" effect at start
		this._started = false;
		data.draw.find("circle").cssSequence("started", "animationend", el => this._started = true);
	}

	updateSnake() {
		if (!this._started) return;
		let msPerGridUnit = 75;
		this.snake.moveTowardsMouse(msPerGridUnit , this.navigationSelector);
		this.snake.render();
	}

	async finishSnake() {
		let APP = witness,
			fadeOutSnake = (sequence="fade-out") => {
				// UI update
				this.el.removeClass("snake-active");
				// fade out snake and empty its contents
				this.el.find(".grid-path").cssSequence(`${sequence}-snake`, "transitionend", el => {
					// reset grid path
					el.removeClass("fade-out-snake failure-snake glow-snake");
					// empty snake body
					if (!this.keepSnake) el.find("svg > g").html("");
					// remove "locked" class
					this.el.removeClass("locked");
				});
			};
		// reset started flag
		delete this._started;

		// to UI debug snake
		// return;

		// path not completed - reset
		if (!this.snake.atEnd()) {
			return fadeOutSnake();
		}

		// Success or failure at end
		let err = Validation.getErrors(this);
		// show errors
		if (err.errors.length) {
			let errors = err.errors.concat(err.allowedErrors);
			// console.log( errors );

			// create error nodes
			errors.map(err => {
				let x = err.coord.i,
					y = err.coord.j,
					el;

				// console.log( err );
				switch (err.drawType) {
					case DrawType.CELL:
						el = this.el.find(`.grid-base .dot[style*="--x: ${x};--y: ${y};"]`);
						if (!el.length) el = this.el.find(`.grid-base .star[style*="--x: ${x};--y: ${y};"]`);
						if (!el.length) el = this.el.find(`.grid-base .tetris[style*="--x: ${x};--y: ${y};"] b`);
						break;
					case DrawType.POINT:
						el = this.el.find(`.grid-base span[style*="--x: ${x};--y: ${y};"] .hex.top`);
						if (!el.length) el = this.el.find(`.grid-base span[style*="--x: ${x};--y: ${y-1};"] .hex.bottom`);
						if (!el.length) el = this.el.find(`.grid-base span[style*="--x: ${x-1};--y: ${y};"] .hex.bottom`);
						break;
					case DrawType.VLINE:
					case DrawType.HLINE:
						el = this.el.find(`.grid-base span[style*="--x: ${x};--y: ${y};"] .hex.middle`);
						break;
				}

				el.cssSequence("error", "animationend", el => el.removeClass("error"));
			});

			// sound fx
			window.audio.play("fail");
			// reset level
			fadeOutSnake("failure");
			return;
		}

		// swap canvas
		let colors = [
				this.el.cssProp("--snake1"),
				this.el.cssProp("--snake2")
			].map(color => {
				let w = 8,
					swap = Utils.createCanvas(w*2, w*2),
					gradient = swap.ctx.createRadialGradient(w, w, 0, w, w, w);
				gradient.addColorStop(0, `${color}`);
				gradient.addColorStop(.975, `${color}33`);
				gradient.addColorStop(.9, `${color}01`);
				gradient.addColorStop(1, `${color}00`);
				swap.ctx.fillStyle = gradient; // "#f00";
				swap.ctx.beginPath();
				swap.ctx.fillRect(0, 0, w*2, w*2);
				return { img: swap.cvs[0], w };
			}),
			fnNext = () => Game.dispatch({ type: "goto-next-level" });
			
		// make sure particles are reset
		Particles.reset();
		// start fire flies
		Particles.start(this, this.snake.snakeEl, colors[0], fnNext);
		// progression power up
		await APP.progression.dispatch({ type: "progress-power-up" });
		// for secondary snake
		if (this.getSymmetry()) {
			Particles.start(this, this.snake.secondarySnakeEl, colors[1]);
		}
		// lock current level
		this.el.addClass("locked");
		// reset level
		fadeOutSnake("glow");
		// sound fx
		window.audio.play("solved");
	}

	forEachEntity(fn, scope) {
		for (var a=0; a<this.storeWidth; a++) {
			for (var b=0; b<this.storeHeight; b++) {
				var value = this.entities[a + this.storeWidth * b];
				var drawType = this.getDrawType(a, b);
				fn.call(scope, value, Math.floor(a / 2), Math.floor(b / 2), drawType);
			}
		}
	}

	setSymmetry(symmetry) {
		this.symmetry = symmetry;
		this.sanitize();
	}

	getSymmetry() {
		if (this.symmetry == SymmetryType.NONE) return null;
		else return new Symmetry(this.symmetry, this.width, this.height);
	}

	// Returns the automatic end orientation at a coord i, j.
	// This is symmetrical for all coordinates and symmetries.
	getEndPlacement(i, j) {
		for (var di = -1; di <= 1; di += 2) {
			var line = this.lineBetweenEntity(i, j, i + di, j);
			if (!line || line.type == Type.NONE) {
				return new Orientation(di, 0);
			}
		}
		for (var dj = -1; dj <= 1; dj += 2) {
			var line = this.lineBetweenEntity(i, j, i, j + dj);
			if (!line || line.type == Type.NONE) {
				return new Orientation(0, dj);
			}
		}
		return null;
	}

	getDrawType(a, b) {
		if (a % 2 == 0 && b % 2 == 0) return DrawType.POINT;
		else if (a % 2 == 1 && b % 2 == 1) return DrawType.CELL;
		else if (a % 2 == 0) return DrawType.VLINE;
		else if (b % 2 == 0) return DrawType.HLINE;
		else throw Error();
	}

	info(i, j, type) {
		return `${type}[${i},${j}]`;
	}

	getEntity(a, b) {
		var index = (this.storeWidth * (b * 2)) + (a * 2);
		return this.entities[index];
	}

	// jQuery-style entity getter/setter.
	entity(a, b, val, info) {
		var index = a + this.storeWidth * b;
		var inRange = a >= 0 && b >= 0 && a < this.storeWidth && b < this.storeHeight;
		if (val && false) {
			// console.log([info, a + "―", b + "|", index].join(","));
			console.log(`${info},${a}-${b}|,${index}`);
		}
		if (val) {
			if (!inRange) throw Error();
			this.entities[index] = val;
		} else {
			if (!inRange) return null;
			return this.entities[index];
		}
	}

	// Should add one for entity by drawtype.
	cellKeyEntity(key, opt_val) {
		return this.cellEntity(key.i, key.j, opt_val);
	}

	pointKeyEntity(key, opt_val) {
		return this.pointEntity(key.i, key.j, opt_val);
	}

	cellEntity(i, j, opt_val) {
		return this.entity(i * 2 + 1, j * 2 + 1, opt_val, this.info(i, j, "□"));
	}

	lineBetweenEntity(i1, j1, i2, j2, val) {
		if (Math.abs(i1 - i2) + Math.abs(j1 - j2) != 1) throw Error(arguments);
		return this.lineEntity(Math.min(i1, i2), Math.min(j1, j2), i1 == i2, val);
	}

	lineEntity(i, j, isDown, val) {
		var goDown = isDown ? 1 : 0,
			a = i * 2 + (1 - goDown),
			b = j * 2 + goDown,
			info = this.info(i, j, goDown ? "|" : "―");
		return this.entity(a, b , val, info);
	}

	pointEntity(i, j, val) {
		return this.entity(i * 2, j * 2, val, this.info(i, j, "•"));
	}

	generateStorage(xLevel) {
		// get grid base
		let xGrid = xLevel.selectSingleNode(`./grid`),
			xpath = ["ns", "nsd", "nse", "we", "wed", "wee"].map(t => `@type="${t}"`),
			xPoints = xGrid.selectNodes(`./i[${xpath.join(" or ")}]`);
		// console.log( xGrid );

		let storage = {
				entity: [],
				symmetry: +xGrid.getAttribute("symmetry") || SymmetryType.NONE,
				width: (+xGrid.getAttribute("width") * 2) + 1,
				height: (+xGrid.getAttribute("height") * 2) + 1,
			};

		[...Array(storage.height)].map(row => {
			[...Array(storage.width)].map(col => {
				storage.entity.push({ type: null });
			});
		});

		xGrid.selectNodes(`./i`).map(xNode => {
			let type = xNode.getAttribute("type"),
				x = +xNode.getAttribute("x"),
				y = +xNode.getAttribute("y"),
				hexTop = xNode.getAttribute("hexTop"),
				hexMid = xNode.getAttribute("hexMid"),
				hexBot = xNode.getAttribute("hexBot"),
				index = (storage.width * (y * 2)) + (x * 2);
			switch (type) {
				case "ns":
					if (hexTop) storage.entity[index].type = Type.HEXAGON;
					if (hexMid) storage.entity[index + storage.width].type = Type.HEXAGON;
					if (hexBot) {
						storage.entity[index + (storage.width * 2)].type = Type.HEXAGON;
					}
					break;
				case "we":
					if (hexTop) storage.entity[index].type = Type.HEXAGON;
					if (hexMid) storage.entity[index + 1].type = Type.HEXAGON;
					if (hexBot) {
						storage.entity[index + 2].type = Type.HEXAGON;
					}
					break;
				case "start":
					storage.entity[index].type = Type.START;
					break;
				case "exit":
					storage.entity[index].type = Type.END;
					storage.entity[index].rotation = +xNode.getAttribute("d");
					break;
				case "nsd":
					storage.entity[index + storage.width].type = Type.DISJOINT;
					if (hexTop) storage.entity[index].type = Type.HEXAGON;
					break;
				case "wed":
					storage.entity[index + 1].type = Type.DISJOINT;
					if (hexTop) storage.entity[index].type = Type.HEXAGON;
					if (hexBot) storage.entity[index + 2].type = Type.HEXAGON;
					break;
				case "nse":
					storage.entity[index + storage.width].type = Type.NONE;
					if (hexTop) storage.entity[index].type = Type.HEXAGON;
					break;
				case "wee":
					storage.entity[index + 1].type = Type.NONE;
					if (hexTop) storage.entity[index].type = Type.HEXAGON;
					if (hexBot) storage.entity[index + 2].type = Type.HEXAGON;
					break;
				case "dot":
					storage.entity[index + storage.width + 1].type = Type.SQUARE;
					storage.entity[index + storage.width + 1].color = +xNode.getAttribute("c");
					break;
				case "star":
					storage.entity[index + storage.width + 1].type = Type.STAR;
					storage.entity[index + storage.width + 1].color = +xNode.getAttribute("c");
					break;
				case "tetris":
					storage.entity[index + storage.width + 1].type = Type.TETRIS;
					storage.entity[index + storage.width + 1].shape = {
						width: +xNode.getAttribute("w"),
						grid: xNode.selectNodes("./g").map(x => x.getAttribute("v") === "1"),
					};
					break;
			}
		});

		if (xLevel.getAttribute("id") === "7.0") {
			// console.log( storage.entity );
			// storage.entity.map((e, i) => console.log( i, JSON.stringify(e) + (i % storage.width == (storage.width-1) ? "---" : "") ));
		}

		// tmp object
		// storage = tmp_entities;
		// internals
		this.entities = storage.entity;
		this.symmetry = storage.symmetry || SymmetryType.NONE;

		var storeHeight = Math.floor(storage.entity.length / storage.width);
		this.width = Math.floor(storage.width / 2);
		this.height = Math.floor(storeHeight / 2);
		this.storeWidth = this.width * 2 + 1;
		this.storeHeight = this.height * 2 + 1;
	}
}
