
let Snake = {
	init() {
		this.APP = witney;
		this.content = witney.content;
		this.doc = $(document);
	},
	start(event) {
		let puzzle = event.el.parents(".puzzle").addClass("started"),
			unit = parseInt(puzzle.cssProp("--unit"), 10),
			pW = puzzle.prop("offsetWidth"),
			pH = puzzle.prop("offsetHeight"),
			sX = +event.el.prop("offsetLeft") + 7,
			sY = +event.el.prop("offsetTop") + 7,
			sR = unit + 5,
			snake = [];
		// snake nest
		snake.push(`<circle class="nest" cx="${sX}" cy="${sY}" r="${sR}"/>`);
		snake.push(`<line class="neck" x1="${sX}" y1="${sY}" x2="${sX}" y2="${sY}"/>`);
		snake.push(`<circle class="head" cx="${sX}" cy="${sY}" r="${unit * .75}"/>`);

		// add snake to DOM
		let el = puzzle.append(`<svg class="snake" viewBox="0 0 ${pW} ${pH}">${snake.join("")}</svg>`),
			head = el.find(".head"),
			neck = el.find(".neck"),
			nest = el.find(".nest");
		this.els = { el, nest, head, neck };

		this.origo = {
			x: event.clientX,
			y: event.clientY,
		};
		// get constraints
		this.getMaxMin();

		// save refernce to puzzle
		this.puzzle = puzzle;
		// cover app content
		this.content.addClass("cover");
		// bind event handler
		this.doc.bind("click mousemove", this.move);
	},
	move(event) {
		let Self = Snake,
			APP = Self.APP;
		switch (event.type) {
			case "click":
				// dispose snake & reset puzzle
				Self.puzzle.find("svg.snake").remove();
				Self.puzzle.removeClass("started");
				// reset app content
				Self.content.removeClass("cover");
				// bind event handler
				Self.doc.unbind("click mousemove", Self.move);
				break;
			case "mousemove":
				let x2 = event.clientX - Self.origo.x,
					y2 = event.clientY - Self.origo.y;
				x2 = Math.min(Math.max(Self.origo.min.x, x2), Self.origo.max.x);
				y2 = Math.min(Math.max(Self.origo.min.y, y2), Self.origo.max.y);
				Self.els.neck.attr({ x2, y2 });
				Self.els.head.attr({ cx: x2, cy: y2 });
				break;
		}
	},
	getMaxMin() {
		let neck = this.els.neck;
		this.origo.min = {
			x: +neck.attr("x1"),
			y: +neck.attr("y1"),
		};
		this.origo.max = {
			x: 231,
			y: +neck.attr("y1"),
		};
	}
};