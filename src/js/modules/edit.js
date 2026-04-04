
// witness.edit

{
	init() {
		// fast references
		this.els = {
			doc: $(document),
			el: window.find(".edit-view"),
			iGridRows: window.find(`input[data-change="set-grid-rows"]`),
			iGridCols: window.find(`input[data-change="set-grid-cols"]`),
			iLine: window.find(`input[data-change="set-grid-line"]`),
			iGap: window.find(`input[data-change="set-grid-gap"]`),
			iCellWidth: window.find(`input[data-change="set-cell-width"]`),
			iCellHeight: window.find(`input[data-change="set-cell-height"]`),
		};
		// keep track of selected edit tool + defaults
		this.activeTool = false;
		this.activeColor = "#fff";
		this.activeColorIndex = 1;
		// palette (numbered eventually)
		this.palette = {};
		// names collected here
		this.editNames = [".edit-cell", ".edit-head", ".edit-body", ".edit-foot"];

		// subscribe to events
		window.on("render-level", this.dispatch);
	},
	async dispatch(event) {
		let APP = witness,
			Self = APP.edit,
			xNode,
			data,
			value,
			target,
			el;
		// console.log(event);
		switch (event.type) {
			// subscribed events
			case "render-level":
				if (Self.els.el.hasClass("show")) {
					Self.dispatch({ type: "init-edit-view" });
					// if any active tool, turn it "off"
					Self.els.el.find(`.option-buttons_ > span.active_`).trigger("click");
				}
				break;
			// custom events
			case "reset-level":
				// anything to do?
				break;
			case "close-view":
			case "toggle-edit-view":
				value = Self.els.el.hasClass("show");
				Self.els.el.toggleClass("show", value);

				// if in edit mode, keep snake to facilitate puzzle making
				Game.grid.keepSnake = !value;

				// if in lobby, render template level
				if (Game.grid.levelId === "0.1") {
					return await APP.dispatch({ type: "render-level", arg: "template" });
				}
				// init edit view, if not already initiated
				if (!value) Self.dispatch({ type: "init-edit-view" });
				break;
			case "output-xml":
				// make sure changes are reflected in xml + game grid
				Self.dispatch({ type: "sync-ui-level" });
				// if any active tool, turn it "off"
				Self.els.el.find(`.option-buttons_ > span.active_`).trigger("click");
				// "clone" the clone
				xNode = Self.levelClone.cloneNode(true);
				// minor clean up
				xNode.removeAttribute("clone");
				xNode.removeAttribute("type");
				// mroe clean up
				xNode.selectSingleNode("./grid").removeAttribute("error");
				// output string
				value = xNode.xml;
				value = value.replace(/    /g, "\t");
				console.log( value );
				break;
			case "blank-template":
				APP.dispatch({ type: "render-level", arg: "template" });
				break;
			case "sync-ui-level":
				// push nodes in to array
				data = [];
				// iterate all nodes
				Self.els.puzzle.find(".grid-base > span").map(elem => {
					let el = $(elem),
						x = el.cssProp("--x"),
						y = el.cssProp("--y"),
						d = el.cssProp("--d"),
						hex = el.find(".hex"),
						attr = [];
					if (hex.length) {
						attr = hex.map(h => {
							let pos;
							switch (true) {
								case h.classList.contains("top"): pos = "Top"; break;
								case h.classList.contains("middle"): pos = "Mid"; break;
								case h.classList.contains("bottom"): pos = "Bot"; break;
							}
							return `hex${pos}="1"`;
						});
					}
					// action based on class name
					switch (elem.className) {
						case "ns":
						case "nsd":
						case "nse":
						case "we":
						case "wed":
						case "wee":
							data.push(`<i type="${elem.className}" x="${x}" y="${y}" ${attr.join(" ")}/>`);
							break;
						case "start":
							data.push(`<i type="${elem.className}" x="${x}" y="${y}" />`);
							break;
						case "exit":
							data.push(`<i type="${elem.className}" x="${x}" y="${y}" d="${d}" />`);
							break;
						case "dot":
							data.push(`<i type="${elem.className}" x="${x}" y="${y}" c="${el.data("c")}" />`);
							break;
						case "star":
							data.push(`<i type="${elem.className}" x="${x}" y="${y}" c="${el.data("c")}" />`);
							break;
						default:
							console.log(elem);
					}
				});
				// reference to grid node
				xNode = Self.levelClone.selectSingleNode(`./grid`);
				// remove all old nodes
				while (xNode.hasChildNodes()) {
					xNode.removeChild(xNode.firstChild);
				}
				// insert new nodes into level clone
				$.xmlFromString(`<data>${data.join("")}</data>`)
					.selectNodes(`//data/*`)
					.map(x => xNode.appendChild(x));
				// render clone level
				Game.grid.renderClone(Self.levelClone);
				
				Self.dispatch({ type: "refresh-references" });
				break;
			case "refresh-references":
				// refresh references
				Self.els.level = Game.grid.el.parent();
				Self.els.puzzle = Self.els.level.find("> .puzzle");
				// add endpoint compass
				if (!Self.els.level.find(".ends-compass").length) {
					await window.render({
						template: "endpoint-compass",
						append: Self.els.level,
					});
				}
				break;
			case "create-clone":
				// remove old clones first
				window.bluePrint.selectNodes(`//Data/Level[@clone]`).map(xClone => xClone.parentNode.removeChild(xClone));
				// append new clone to bluePrint
				xNode = window.bluePrint.selectSingleNode(`//Data/Level[@id="${Game.grid.levelId}"]`);
				Self.levelClone = xNode.parentNode.appendChild(xNode.cloneNode(true));
				Self.levelClone.setAttribute("clone", Game.grid.levelId);
				break;
			case "init-edit-view":
				// save reference to level root element
				Self.els.level = Game.grid.el.parent();
				Self.els.puzzle = Self.els.level.find("> .puzzle");

				Self.els.iGridRows.val(Game.grid.height);
				Self.els.iGridCols.val(Game.grid.width);
				
				Self.els.iLine.val( parseInt(Self.els.level.cssProp("--line")) );
				Self.els.iGap.val( parseInt(Self.els.level.cssProp("--gap")) );
				Self.els.iCellWidth.val( parseInt(Self.els.level.cssProp("--gW")) );
				Self.els.iCellHeight.val( parseInt(Self.els.level.cssProp("--gH")) );

				// update palette selectbox
				value = Self.els.level.data("palette");
				// Self.els.el.find(`selectbox[data-menu="grid-palette"]`).val(value);
				Self.dispatch({ type: "set-palette", arg: value });

				// color preset
				xNode = window.bluePrint.selectSingleNode(`//Palette[@id="${value}"]/c[@id="1"]`);
				Self.dispatch({ type: "set-extras-color", arg: xNode.getAttribute("val") });

				// update symmetry selectbox
				value = Self.els.level.data("symmetry") || 1;
				Self.els.el.find(`selectbox[data-menu="grid-symmetry"]`).val(value);

				// create level clone
				Self.dispatch({ type: "create-clone" });
				// insert elements to facilitate editing
				// Self.dispatch({ type: "add-edit-elements" });

				// add endpoint compass
				if (!Self.els.level.find(".ends-compass").length) {
					await window.render({
						template: "endpoint-compass",
						append: Self.els.level,
					});
				}
				break;
			case "calculate-puzzle-layout":
				data = {};
				data.width = (UI.CELL_WIDTH * Game.grid.width) + UI.GRID_LINE;
				data.height = (UI.CELL_HEIGHT * Game.grid.height) + UI.GRID_LINE;
				data.top = (window.innerHeight - data.height) >> 1;
				data.left = (window.innerWidth - data.width) >> 1;
				Self.els.puzzle.css(data);
				break;
				
			case "add-edit-elements":
				// remove old, if any
				Self.els.puzzle.find(Self.editNames.join(",")).remove();
				// for cells
				value = [...Array(Game.grid.width * Game.grid.height)].map((c, i) => {
					let x = i % Game.grid.width,
						y = (i / Game.grid.width) | 0;
					return `<s class="edit-cell" style="--x: ${x}; --y: ${y};"></s>`;
				});
				Self.els.puzzle.find(".grid-base").append(value.join(""));

				// for grid lines
				Self.els.puzzle.find(".ns, .nsd, .nse, .we, .wed, .wee").map(elem => {
					let str = [
							`<s class="edit-head"></s>`,
							`<s class="edit-body"></s>`,
							`<s class="edit-foot"></s>`,
						];
					$(elem).append(str.join(""));
				});

				// add click event handler
				Self.els.puzzle.data({
					area: "edit",
					click: "do-edit-tool",
				});
				break;
			case "clear-edit-elements":
				// cleansing
				Self.els.puzzle
					.removeAttr("data-area")
					.removeAttr("data-click")
					.find(Self.editNames.join(",")).remove();
				break;

			case "sync-cell-width":
				value = +event.el.parents(".row:first").find("input").val();
				Self.els.iCellHeight.val(value);
				Self.dispatch({ type: "set-cell-height", value });
				break;
			case "sync-cell-height":
				value = +event.el.parents(".row:first").find("input").val();
				Self.els.iCellWidth.val(value);
				Self.dispatch({ type: "set-cell-width", value });
				break;
			case "set-grid-rows":
				if (event.value > Game.grid.height) {
					data = [];
					[...Array(Game.grid.width)].map((c, i) => {
						data.push(`<i type="ns" x="${i}" y="${event.value-1}" />`);
						data.push(`<i type="we" x="${i}" y="${event.value}" />`);
					});
					data.push(`<i type="ns" x="${Game.grid.width}" y="${event.value-1}" />`);
					// get grid node
					xNode = Self.levelClone.selectSingleNode(`./grid`);
					// insert new nodes to levelClone
					$.xmlFromString(`<data>${data.join("")}</data>`).selectNodes("//data/i").map(x => xNode.appendChild(x));
					// add to grid dim
					Game.grid.height++;
					// update level node
					xNode.setAttribute("height", Game.grid.height);
					// prevents wrongfully places hexagons
					Self.dispatch({ type: "clear-all-hexagons", xNode });
					// render clone level
					Game.grid.renderClone(Self.levelClone);
				} else if (Game.grid.height > 1) {
					// get grid node
					xNode = Self.levelClone.selectSingleNode(`./grid`);
					// remove nodes
					xNode.selectNodes(`./i[@y="${Game.grid.height}"]`).map(x => x.parentNode.removeChild(x));
					xNode.selectNodes(`./i[@type="ns"][@y="${Game.grid.height-1}"]`).map(x => x.parentNode.removeChild(x));
					xNode.selectNodes(`./i[@type="nsd"][@y="${Game.grid.height-1}"]`).map(x => x.parentNode.removeChild(x));
					xNode.selectNodes(`./i[@type="nse"][@y="${Game.grid.height-1}"]`).map(x => x.parentNode.removeChild(x));
					xNode.selectNodes(`./i[@type="star" or @type="dot"][@y="${Game.grid.height-1}"]`).map(x => x.parentNode.removeChild(x));
					// add to grid dim
					Game.grid.height--;
					// update level node
					xNode.setAttribute("height", Game.grid.height);
					// prevents wrongfully places hexagons
					Self.dispatch({ type: "clear-all-hexagons", xNode });
					// render clone level
					Game.grid.renderClone(Self.levelClone);
				}
				// referesh internal references
				Self.dispatch({ type: "refresh-references" });
				break;
			case "set-grid-cols":
				if (event.value > Game.grid.width) {
					data = [];
					[...Array(Game.grid.height)].map((c, i) => {
						data.push(`<i type="ns" x="${event.value}" y="${i}" />`);
						data.push(`<i type="we" x="${event.value-1}" y="${i}" />`);
					});
					data.push(`<i type="we" x="${event.value-1}" y="${Game.grid.height}" />`);
					// get grid node
					xNode = Self.levelClone.selectSingleNode(`./grid`);
					// insert new nodes to levelClone
					$.xmlFromString(`<data>${data.join("")}</data>`).selectNodes("//data/i").map(x => xNode.appendChild(x));
					// add to grid dim
					Game.grid.width++;
					// update level node
					xNode.setAttribute("width", Game.grid.width);
					// prevents wrongfully places hexagons
					Self.dispatch({ type: "clear-all-hexagons", xNode });
					// render clone level
					Game.grid.renderClone(Self.levelClone);
				} else if (Game.grid.width > 1) {
					// get grid node
					xNode = Self.levelClone.selectSingleNode(`./grid`);
					// remove nodes
					xNode.selectNodes(`./i[@x="${Game.grid.width}"]`).map(x => x.parentNode.removeChild(x));
					xNode.selectNodes(`./i[@type="we"][@x="${Game.grid.width-1}"]`).map(x => x.parentNode.removeChild(x));
					xNode.selectNodes(`./i[@type="wed"][@x="${Game.grid.width-1}"]`).map(x => x.parentNode.removeChild(x));
					xNode.selectNodes(`./i[@type="wee"][@x="${Game.grid.width-1}"]`).map(x => x.parentNode.removeChild(x));
					xNode.selectNodes(`./i[@type="star" or @type="dot"][@x="${Game.grid.width-1}"]`).map(x => x.parentNode.removeChild(x));
					// add to grid dim
					Game.grid.width--;
					// update level node
					xNode.setAttribute("width", Game.grid.width);
					// prevents wrongfully places hexagons
					Self.dispatch({ type: "clear-all-hexagons", xNode });
					// render clone level
					Game.grid.renderClone(Self.levelClone);
				}
				// referesh internal references
				Self.dispatch({ type: "refresh-references" });
				break;
			case "clear-all-hexagons":
				// clear hex when grid resize
				event.xNode.selectNodes(`./i[@hexTop]`).map(x => x.removeAttribute("hexTop"));
				event.xNode.selectNodes(`./i[@hexMid]`).map(x => x.removeAttribute("hexMid"));
				event.xNode.selectNodes(`./i[@hexBot]`).map(x => x.removeAttribute("hexBot"));
				break;
			case "set-cell-width":
				Self.els.level.css({ "--gW": `${event.value}px` });
				// transfer value to xml
				Self.levelClone.selectSingleNode(`./grid`).setAttribute("gW", event.value);
				// update "constants"
				UI.CELL_WIDTH = event.value;
				// update UI
				Self.dispatch({ type: "calculate-puzzle-layout" });
				break;
			case "set-cell-height":
				Self.els.level.css({ "--gH": `${event.value}px` });
				// transfer value to xml
				Self.levelClone.selectSingleNode(`./grid`).setAttribute("gH", event.value);
				// update "constants"
				UI.CELL_HEIGHT = event.value;
				// update UI
				Self.dispatch({ type: "calculate-puzzle-layout" });
				break;
			case "set-grid-gap":
				Self.els.level.css({ "--gap": `${event.value}px` });
				// transfer value to xml
				Self.levelClone.selectSingleNode(`./grid`).setAttribute("gap", event.value);
				// update "constants"
				UI.DISJOINT_LENGTH = event.value;
				break;
			case "set-grid-line":
				Self.els.level.css({ "--line": `${event.value}px` });
				// transfer value to xml
				Self.levelClone.selectSingleNode(`./grid`).setAttribute("line", event.value);
				// update "constants"
				UI.GRID_LINE = event.value;
				// update UI
				Self.dispatch({ type: "calculate-puzzle-layout" });
				break;
			case "set-symmetry":
				// update UI
				Self.els.el.find(`selectbox[data-menu="grid-symmetry"]`).val(event.arg);
				break;
			case "set-palette":
				// update UI
				Self.els.el.find(`selectbox[data-menu="grid-palette"]`).val(event.arg);
				// transfer value to xml
				if (Self.levelClone) Self.levelClone.setAttribute("palette", event.arg);
				// update UI element
				Self.els.level.data({ palette: event.arg });
				// transfer color values
				data = {};
				xNode = window.bluePrint.selectSingleNode(`//Palette[@id="${event.arg}"]`);
				xNode.selectNodes(`./c`).map(xColor => {
					let key = xColor.getAttribute("key"),
						id = xColor.getAttribute("id");
					if (key) data[`--${key}`] = xColor.getAttribute("val");
					else if (id) {
						data[`--c${id}`] = xColor.getAttribute("val");
						// save reference for later use
						Self.palette[id] = xColor.getAttribute("val");
					}
				});
				// level update
				Self.els.level.css(data);
				// base bg color
				Self.els.level.parents("content").css({ "--base": data["--base"] });

				// color preset
				xNode = xNode.selectSingleNode(`./c[@id="1"]`);
				Self.dispatch({ type: "set-extras-color", arg: xNode.getAttribute("val") });
				break;
			case "select-base-tool":
			case "select-extras-tool":
				el = $(event.target);
				if (!el.parent().hasClass("option-buttons_")) return;
				
				// clear old hovers
				value = ["cells", "lines", "starts", "ends"].map(e => `hover-${e}`).join(" ");
				Game.grid.el.removeClass(value);

				// turn off tool
				if (el.hasClass("active_")) {
					// turn off tool
					el.removeClass("active_");
					// make sure changes are reflected in xml + game grid
					Self.dispatch({ type: "sync-ui-level" });
					// remove edit elements
					Self.dispatch({ type: "clear-edit-elements" });
					// reset selected tool
					Self.activeTool = false;
					return;
				}
				
				// if (!Self.els.puzzle.find(Self.editNames.join(",")).length) {
					// remove edit elements
					Self.dispatch({ type: "add-edit-elements" });
				// }

				Self.els.el.find(`.option-buttons_ .active_`).removeClass("active_");
				// ui update
				el.addClass("active_");
				// set active edit tool
				Self.activeTool = el.data("arg");
								
				// toggle hover areas
				value = el.data("hover").split(" ").map(e => `hover-${e}`).join(" ");
				Game.grid.el.addClass(value);

				if (Game.grid.el.hasClass("hover-ends")) {
					// count junction edit-endpoints
					let gHeight = Game.grid.height + 1,
						gWidth = Game.grid.width + 1,
						grid = [...Array(gHeight)];
					grid.map((row, y) => grid[y] = [...Array(gWidth)].map(col => ""));

					// get all lines
					Self.els.puzzle.find(".ns, .nsd, .nse, .we, .wed, .wee").map(elem => {
						let el = $(elem),
							x = +el.cssProp("--x"),
							y = +el.cssProp("--y");
						if (el.hasClass("ns") || el.hasClass("nsd")) {
							grid[y][x] += "4";
							if (y < gHeight) grid[y+1][x] += "0";
						}
						if (el.hasClass("we") || el.hasClass("wed")) {
							grid[y][x] += "2";
							if (x < gWidth) grid[y][x+1] += "6";
						}
					});

					// transform to css class name
					grid.map((r, y) => r.map((c, x) => {
						let junction = grid[y][x].split("").sort((a,b) => +a - +b).join(""),
							jEl = Self.els.puzzle.find(`.grid-base span[style*="--x: ${x};--y: ${y};"]`);
						if (!jEl.length) jEl = Self.els.puzzle.find(`.grid-base span[style*="--x: ${x};--y: ${y-1};"] s.edit-foot`);
						jEl.data({ junction });
					}));
				}
				break;

			case "before-menu:extras-color":
				value = Self.els.level.data("palette");
				window.bluePrint.selectNodes(`//Palette[@id="${value}"]/c[@id]`).map(xColor => {
					let id = xColor.getAttribute("id"),
						val = xColor.getAttribute("val"),
						xpath = `//Menu[@for="extras-color"]/Menu[@click="set-extras-color"]/Color[${id}]`,
						xMenu = window.bluePrint.selectSingleNode(xpath);
					xMenu.setAttribute("arg", val)
				});
				// console.log( window.bluePrint.selectSingleNode(`//Menu[@for="extras-color"]/Menu`) );
				break;
			case "set-extras-color":
				// UI update
				Self.els.el.find(`.color-preset_[data-menu="extras-color"]`).css({ "--preset-color": event.arg });
				// save reference to color
				Self.activeColor = event.arg;
				Object.keys(Self.palette).map(k => {
					if (Self.palette[k] === event.arg) {
						Self.activeColorIndex = k;
					}
				});
				break;

			case "rotate-endpoint":
				event.el.find(".active").removeClass("active");
				el = $(event.target).addClass("active");
				// update exit direction
				Self.activeExit.css({ "--d": el.data("no") });
				break;

			case "do-edit-tool":
				target = $(event.target);
				el = target.parents("?span");
				// collect info
				data = {};
				if (el.length) {
					data.junction = el.parents(`?[data-junction]`).data("junction");
					data.x = +el.cssProp("--x");
					data.y = +el.cssProp("--y");
				}
				// console.log(event);
				switch (Self.activeTool) {
					case "start":
						if (!el.length) return;
						if (!el.hasClass("we") && target.hasClass("edit-foot")) {
							data.y++;
						}
						if (el.hasClass("we") && target.hasClass("edit-foot")) {
							data.x++;
						}

						data.sEl = Self.els.level.find(`.start[style*="--x: ${data.x};--y: ${data.y};"]`);
						if (data.sEl.length) {
							// remove existing start
							data.sEl.remove();
						} else {
							// remove end-points, if any
							Self.els.level.find(`.exit[style*="--x: ${data.x};--y: ${data.y};"]`).remove();
							// insert new element
							value = `<span class="start" style="--x: ${data.x};--y: ${data.y};" data-click="init-snake"></span>`;
							Self.els.level.find(".grid-base").append(value);
						}
						break;
					case "end":
						data.cEl = Self.els.level.find(".ends-compass");
						data.cOffset = data.cEl.offset();
						data.offset = target.offset(".level");

						// reset directions
						data.cEl.find(".disabled").removeClass("disabled");
						// exit if clicked item is not a junction
						if (!data.junction) return;
						// for right bottom corner
						if (target.hasClass("edit-foot") && target.data("junction")) {
							data.junction = target.data("junction");
							data.y++;
						}
						// remove starts, if any
						Self.els.level.find(`.start[style*="--x: ${data.x};--y: ${data.y};"]`).remove();
						// loop end points
						data.junction.split("").map(i => {
							let no = +i + 8;
							data.cEl.find(`span[data-no="${(no - 1) % 8}"]`).addClass("disabled");
							data.cEl.find(`span[data-no="${(no + 1) % 8}"]`).addClass("disabled");
							data.cEl.find(`span[data-no="${no % 8}"]`).addClass("disabled");
						});
						// show compass
						data.cEl
							.css({
								top: data.offset.top - ((data.cOffset.width - data.offset.width) >> 1) - 1,
								left: data.offset.left - ((data.cOffset.height - data.offset.height) >> 1) - 1,
							})
							.removeClass("hidden");
						
						// save reference to active exit
						Self.activeExit = Self.els.level.find(`.exit[style*="--x: ${data.x};--y: ${data.y};"]`);
						// another try
						if (!Self.activeExit.length) Self.activeExit = Self.els.level.find(`.exit[style*="--x: ${data.x}; --y: ${data.y};"]`);

						// next click listener
						let func = e => {
								let el = $(e.target).parents("?.ends-compass");
								if (!el.length) {
									// clear reference
									delete Self.activeExit;
									// hide compass
									data.cEl.addClass("hidden");
									// reset compass
									data.cEl.find(".active, .disabled").removeClass("active disabled");
									// unbind event handler
									Self.els.doc.off("click", func);
								}
							};

						if (target.hasClass("edit-head") && Self.activeExit.length) {
							// remove exit element
							Self.activeExit.remove();
							// clears compass
							return func(event);
						} else {
							// available directions
							let taken = data.junction.split(""),
								available = "0246".split("").filter(a => !taken.includes(a));
							// insert new element
							value = `<span class="exit" style="--x: ${data.x};--y: ${data.y};--d: ${available[0]};" data-junction="${data.junction}"></span>`;
							Self.activeExit = Self.els.level.find(".grid-base").append(value);
						}
						// make direction active on compass
						data.cEl.find(`span[data-no="${Self.activeExit.cssProp("--d")}"]`).addClass("active");

						// bind event handler
						Self.els.doc.on("click", func);
						break;
					case "hexagon":
						// for right bottom corner
						// console.log(event.target);
						// change classname
						switch (true) {
							case target.hasClass("edit-head"):
								if (el.find("i.hex.top").length) el.find("i.hex.top").remove();
								else el.prepend(`<i class="hex top"></i>`);
								break;
							case target.hasClass("edit-body"):
								if (el.hasClass("nsd")) el.removeClass("nsd").addClass("ns");
								if (el.hasClass("wed")) el.removeClass("wed").addClass("we");
								if (el.find("i.hex.middle").length) el.find("i.hex.middle").remove();
								else el.prepend(`<i class="hex middle"></i>`);
								break;
							case target.hasClass("edit-foot"):
								if (el.find("i.hex.bottom").length) el.find("i.hex.bottom").remove();
								else el.prepend(`<i class="hex bottom"></i>`);
								break;
						}
						break;
					case "disjoint":
						// change classname
						switch (true) {
							case el.hasClass("we"):  el.removeClass("we").addClass("wed"); break;
							case el.hasClass("wed"): el.removeClass("wed").addClass("we"); break;
							case el.hasClass("ns"):  el.removeClass("ns").addClass("nsd"); break;
							case el.hasClass("nsd"): el.removeClass("nsd").addClass("ns"); break;
						}
						break;
					case "dot":
					case "star":
						if (!el.length && target.hasClass("edit-cell")) {
							data.x = +target.cssProp("--x");
							data.y = +target.cssProp("--y");
							el = Self.els.level.find(`.${Self.activeTool}[style*="--x: ${data.x};--y: ${data.y};"]`);
						}
						if (el.hasClass("dot") && el.length) {
							el.remove();
						} else {
							value = `<span class="${Self.activeTool}" data-c="${Self.activeColorIndex}" style="--x: ${data.x};--y: ${data.y};--c: ${Self.activeColor};"></span>`;
							Self.els.level.find(".grid-base").append(value);
						}
						break;
					case "lambda":
						// disabled for now
						break;
					case "erase":
						// erase depending on what is clicked
						switch (true) {
							case el.hasClass("ns"): // remove line
							case el.hasClass("nsd"):
								el.removeClass("ns nsd").addClass("nse");
								break;
							case el.hasClass("nse"): // add line
								el.removeClass("nse").addClass("ns");
								break;
							case el.hasClass("we"): // remove line
							case el.hasClass("wed"):
								el.removeClass("we wed").addClass("wee");
								break;
							case el.hasClass("wee"): // add line
								el.removeClass("wee").addClass("we");
								break;
							case target.hasClass("edit-cell"): // empty cell
								data.x = target.cssProp("--x");
								data.y = target.cssProp("--y");
								value = [
									`.dot[style*="--x: ${data.x};--y: ${data.y};"]`,
									`.star[style*="--x: ${data.x};--y: ${data.y};"]`,
									`.lambda[style*="--x: ${data.x};--y: ${data.y};"]`,
								];
								Self.els.puzzle.find(value.join(",")).remove();
								break;
						}
						// console.log(target);
						break;
				}
				break;
		}
	}
}
