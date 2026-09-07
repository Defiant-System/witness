
let Game = {
	init() {
		// fast references
		this.doc = $(document);
		this.grid = new Grid();
		// levels list
		this.level = { index: 0, list: [] };
		// populate contextmenu
		this.dispatch({ type: "populate-contextmenu" });
	},
	async dispatch(event) {
		let APP = witness,
			Self = Game,
			data,
			el;
		switch (event.type) {
			// native events
			case "click":
			case "init-snake":
				// start cicle was clicked
				if (Self._locked) {
					// release mouse lock
					document.exitPointerLock();
					delete Self._locked;

					// end state of snake
					Game.grid.finishSnake();

					// unbind event handlers
					Self.doc.off("click", Self.dispatch);
					Self.doc.off("mousemove", Self.dispatch);
				} else {
					Self.grid.el[0].requestPointerLock();
					Self._locked = true;

					// bind event handlers
					Self.doc.on("click", Self.dispatch);
					Self.doc.on("mousemove", Self.dispatch);

					el = $(event.target);
					data = {
						x: +el.cssProp("--x"),
						y: +el.cssProp("--y"),
						mX: event.clientX,
						mY: event.clientY,
					};
					Game.grid.initializeSnake(data);
				}
				break;
			case "mousemove":
				if (!Game.grid.snake.targetingMouse && event.movementX != undefined) {
					Game.grid.snake.setMouseDiff(event.movementX, event.movementY);
					Game.grid.scheduleSnakeUpdate();
				} else {
					Game.grid.snake.targetingMouse = false;
				}
				break;
			// custom events
			case "render-level":
				data = event.arg;
				if (!data && event.xMenu) data = event.xMenu.getAttribute("name");
				Self.grid.render(data);
				break;
			case "goto-next-level":
				if (APP.edit.els.el.hasClass("show")) {
					// if in edit mode, do not go to next level
					return APP.edit.dispatch({ type: "reset-level" });
				}
				if (Self.grid.levelId === "0.1") {
					APP.state.progression = [-1];
					await APP.progression.dispatch({ type: "apply-saved-state", noJump: true });
				}
				Self.level.index = Self.level.list.indexOf(Self.grid.levelId) + 1;
				if (Self.level.index > Self.level.list.length - 1) Self.level.index = 0;
				Self.grid.render(Self.level.list[Self.level.index]);
				break;
			case "populate-contextmenu":
				// populate menu
				let world = 0,
					xStr = [];
				window.bluePrint.selectNodes(`//Data/Level[not(@type)]`).map(x => {
					let xId = x.getAttribute("id"),
						xWorld = +xId.split(".")[0];
					if (world > 0 && world !== xWorld) xStr.push(`</Menu>`);
					if (world !== xWorld) {
						xStr.push(`<Menu name="Level ${xWorld}&#8230;" worldId="${xWorld}" disabled="1">`);
					}
					xStr.push(`<Menu name="${xId}" check-group="active-level" click="render-level" levelId="${xId}" disabled="1"/>`);
					if (world !== xWorld) world = xWorld;
					// add to level list
					Self.level.list.push(xId);
				});
				// close last world "node"
				xStr.push(`</Menu>`);

				// insert "real" menu options
				let xLevels = window.bluePrint.selectSingleNode(`//Menu[@for="puzzle-options"]`);
				$.xmlFromString(`<data>${xStr.join("")}</data>`).selectNodes(`/data/Menu`)
					.map(xMenu => xLevels.appendChild(xMenu));
				// finalize / commit menu changes to bluePrint
				window.menuBar.commit();

				// make sure level list is sorted
				Self.level.list.sort((a, b) => {
					let [a1, a2] = a.split(".").map(i => +i),
						[b1, b2] = b.split(".").map(i => +i);
					return a1 > b1 && a2 > b2;
				});
				// console.log( this.level.list.join("\n") );
				break;

		}
	}
};
