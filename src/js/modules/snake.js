
let Snake = {
	init() {
		this.APP = witney;
		this.content = witney.content;
		// 0 : up
		// 1 : right
		// 2 : down
		// 3 : left
		this.direction = false;

		// temp
		// this.content.find(".puzzle").addClass("solved");

		// console.log( this.getDirection({ x: 0, y: 0 }, { x: 0, y: -2 }) ); // up
		// console.log( this.getDirection({ x: 0, y: 0 }, { x: 2, y: 0 }) ); // right
		// console.log( this.getDirection({ x: 0, y: 0 }, { x: 0, y: 2 }) ); // down
		// console.log( this.getDirection({ x: 0, y: 0 }, { x: -2, y: 0 }) ); // left
	},
	draw(opt) {
		let snake = [],
			body = [],
			oW = +opt.el.prop("offsetWidth"),
			oH = +opt.el.prop("offsetHeight"),
			unit = parseInt(opt.el.cssProp("--unit"), 10),
			cell = unit * 5,
			path = opt.path.split(";");
		// loop path points
		path.map((p, i) => {
			let [x,y,type] = p.split(",");
			x = x * cell;
			y = y * cell;
			// add point to snake body array
			body.push(`${x},${y}`);
			// snake nest
			if (type === "N") {
				snake.push(`<circle class="nest" cx="${x}" cy="${y}" r="${unit + 5}"/>`);
			}
			// snake head
			if (i === path.length-1) {
				snake.push(`<polyline class="body" points="${body.join(" ")}"/>`);
				snake.push(`<circle class="head" cx="${x}" cy="${y}" r="${unit * .5}""/>`);
			}
		});
		// add snake SVG to DOM
		opt.el
			.addClass("solved")
			.append(`<svg class="snake" viewBox="0 0 ${oW} ${oH}">${snake.join("")}</svg>`);
	},
	start(opt) {
		let puzzle = opt.el.parents(".puzzle").addClass("started"),
			oW = +puzzle.prop("offsetWidth"),
			oH = +puzzle.prop("offsetHeight"),
			oX = +opt.el.prop("offsetLeft"),
			oY = +opt.el.prop("offsetTop"),
			unit = parseInt(puzzle.cssProp("--unit"), 10),
			els = [];
		// snake body in points
		this.body = [[oX, oY], [oX, oY]];
		// snake SVG
		els.push(`<circle class="nest" cx="${oX}" cy="${oY}" r="${unit + 5}"/>`);
		els.push(`<polyline class="body" points="${this.body.join(" ")}"/>`);
		els.push(`<circle class="head" cx="${oX}" cy="${oY}" r="${unit * .5}""/>`);
		// add snake SVG to DOM
		let svg = puzzle.append(`<svg class="snake" viewBox="0 0 ${oW} ${oH}">${els.join("")}</svg>`);
		// fast references to snake parts
		this.els = {
			nest: svg.find(".nest"),
			body: svg.find(".body"),
			head: svg.find(".head"),
			spans: puzzle.find("> span"),
		};
		// reference to element snake currently is on
		this.onEl = opt.el;
		// grid details
		this.grid = {
			unit,
			u2: unit / 2,
			width: +puzzle.cssProp("--width"),
			height: +puzzle.cssProp("--height"),
			cols: (+puzzle.cssProp("--width") * 2) + 1,
			rows: (+puzzle.cssProp("--height") * 2) + 1,
		};
		// span rectangles
		this.rects = this.els.spans.map(el => ({
			y: el.offsetTop,
			x: el.offsetLeft,
			width: el.offsetWidth,
			height: el.offsetHeight,
		}));
		// calculate max/min for all junctions
		this.junctions = this.getJuntions();

		this.pos = {
			origo: {
				x: opt.clientX || oX,
				y: opt.clientY || oY,
			},
			joint: {
				x: oX,
				y: oY,
			},
			min: { x: 0, y: 0 },
			max: { x: 0, y: 210 },
		};

		// bind event handler
		this.content.bind("click mousemove", this.mouse);
	},
	move(opt) {
		let end = this.body.length - 1,
			d = (opt.dir + 1) % 2,
			step = (opt.step || 10) * ((opt.dir + 1) % 4 <= 1 ? -1 : 1),
			neck = this.body[end];

		neck[d] += step;
		let points = this.body.join(" ");
		this.els.body.attr({ points });
		this.els.head.attr({ cx: neck[0], cy: neck[1] });
	},
	mouse(event) {
		let Self = Snake,
			APP = Self.APP;
		switch (event.type) {
			case "click":
				break;
			case "mousemove":
				let x = event.clientX - Self.pos.origo.x + Self.pos.joint.x,
					y = event.clientY - Self.pos.origo.y + Self.pos.joint.y,
					onEl = Self.getOnEl(),
					points = Self.body,
					neck = points[points.length-1];
				
				if (onEl.hasClass("junc-*")) {
					let onIndex = Self.junctions.els.indexOf(onEl[0]),
						limit = Self.junctions.maxMins[onIndex];
					
					// snap to junction
					let joint = {
						x: +onEl.prop("offsetLeft"),
						y: +onEl.prop("offsetTop"),
					};

					Self.pos.min = { ...limit.min };
					Self.pos.max = { ...limit.max };

					let dir = Self.getDirection(joint, { x, y });
					if (dir % 2 === 0) {
						Self.pos.min.x =
						Self.pos.max.x = joint.x;
					} else {
						Self.pos.min.y =
						Self.pos.max.y = joint.y;
					}
					// Self.pos.joint = joint;

					// points.push([x, y]);
					// neck = points[points.length-1];

					// update reference
					Self.onEl = onEl;
				}

				x = Math.min(Math.max(Self.pos.min.x, x), Self.pos.max.x);
				y = Math.min(Math.max(Self.pos.min.y, y), Self.pos.max.y);
				Self.els.head.attr({ cx: x, cy: y });
				
				neck[0] = x;
				neck[1] = y;
				// console.log( points.join(" ") );
				Self.els.body.attr({ points: points.join(" ") });
				break;
		}
	},
	getJuntions() {
		let els = this.els.spans.filter(el => el.classList[0].startsWith("junc-") && !el.classList.contains("empty")),
			maxMins = els.map(el => this.getLimits($(el)));
		return { els, maxMins };
	},
	getCardinals(el) {
		let [type, dir] = el.prop("classList")[0].split("-"),
			cardinals = "nwse".split("");
		return dir.split("").map(c => cardinals.indexOf(c));
	},
	getDirection(p1, p2) {
		let y = p1.y - p2.y,
			x = p1.x - p2.x,
			theta = Math.atan2(y, x) * (180/Math.PI);
		if (theta < 0) theta = 360 + theta;
		return y == 0 && x == 0 ? null : Math.max((Math.round(theta / 90) + 3) % 4, 0);
	},
	getOnEl() {
		let head = this.els.head[0].getBBox();
		head.x += this.grid.u2 + 2;
		head.y += this.grid.u2 + 2;
		head.width -= 4;
		head.height -= 4;
		for (let i=0, il=this.rects.length; i<il; i++) {
			let rect = this.rects[i];
			if (head.x > rect.x &&
				head.x + head.width < rect.x + rect.width &&
				head.y > rect.y &&
				head.y + head.height < rect.y + rect.height) {
				return $(this.els.spans[i]);
			}
		}
		return this.onEl;
	},
	getLimits(el) {
		let dirs = this.getCardinals(el),
			grid = this.grid,
			spans = this.els.spans,
			onIndex = el.index(),
			colIndex = onIndex % grid.cols,
			rowIndex = Math.floor(onIndex / grid.cols),
			rowEls = spans.filter((e, i) => i >= rowIndex * grid.cols && i < (rowIndex + 1) * grid.cols),
			colEls = spans.filter((e, i) => i % grid.cols == colIndex),
			min = {
				x: +el.prop("offsetLeft"),
				y: +el.prop("offsetTop"),
			},
			max = {
				x: +el.prop("offsetLeft"),
				y: +el.prop("offsetTop"),
			};
		// horisontal - backwards from "onEl"
		for (let i=colIndex; i>0; i--) {
			if (rowEls[i-1].classList.contains("empty")) {
				colIndex -= i;
				rowEls = rowEls.splice(i);
				break;
			}
		}
		for (let i=colIndex; i>0; i--) {
			if (rowEls[i-1].classList.contains("break-we")) {
				colIndex -= i-1;
				rowEls = rowEls.splice(i-1);
				break;
			}
		}
		// vertical - forwards from "onEl"
		for (let i=colIndex, il=rowEls.length; i<il; i++) {
			if (rowEls[i].classList.contains("empty")) {
				rowEls.splice(i);
				break;
			}
		}
		for (let i=colIndex, il=rowEls.length; i<il; i++) {
			if (rowEls[i].classList.contains("break-we")) {
				rowEls.splice(i+1);
				break;
			}
		}
		// vertical - backwards from "onEl"
		for (let i=rowIndex; i>0; i--) {
			if (colEls[i-1].classList.contains("empty")) {
				rowIndex -= i;
				colEls = colEls.splice(i);
				break;
			}
		}
		for (let i=rowIndex; i>0; i--) {
			if (colEls[i-1].classList.contains("break-ns")) {
				rowIndex -= i-1;
				colEls = colEls.splice(i-1);
				break;
			}
		}
		// vertical - forwards from "onEl"
		for (let i=rowIndex, il=colEls.length; i<il; i++) {
			if (colEls[i].classList.contains("empty")) {
				colEls.splice(i);
				break;
			}
		}
		for (let i=rowIndex, il=colEls.length; i<il; i++) {
			if (colEls[i].classList.contains("break-ns")) {
				colEls.splice(i+1);
				break;
			}
		}
		// decrease constraints
		if (dirs.includes(1) || dirs.includes(3)) {
			rowEls.map((el, i) => {
				if (i < colIndex) {
					min.x -= el.classList.contains("break-we")
							? grid.unit * 1.5
							: +el.offsetWidth;
				}
				if (i >= colIndex) {
					max.x += el.classList.contains("break-we")
							? grid.unit * 1.5
							: +el.offsetWidth;
				}
			});
			max.x -= grid.unit;
		}
		if (dirs.includes(0) || dirs.includes(2)) {
			colEls.map((el, i) => {
				if (i < rowIndex) {
					min.y -= el.classList.contains("break-ns")
							? grid.unit * 1.5
							: +el.offsetHeight;
				}
				if (i >= rowIndex) {
					max.y += el.classList.contains("break-ns")
							? grid.unit * 1.5
							: +el.offsetHeight;
				}
			});
			max.y -= grid.unit;
		}
		return { min, max };
	}
};
