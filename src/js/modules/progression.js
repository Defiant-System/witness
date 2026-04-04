
// witness.progression

{
	init() {
		// fast references
		this.els = {
			el: window.find(".progression"),
		};
		// keep track of active world / level
		this.active = {
			world: -1,
			level: -1,
		};
		// subscribe to event
		window.on("render-level", this.dispatch);
	},
	async dispatch(event) {
		let APP = witness,
			Self = APP.progression,
			xNode,
			value,
			el;
		// console.log(event);
		switch (event.type) {
			// subscribed events
			case "render-level":
				// set title of progression element
				Self.els.el.attr({ title: `Level ${event.detail.id}` });

				let [w, l] = event.detail.id.split(".").map(i => +i);
				Self.active.world = w;
				Self.active.level = l;

				// update UI
				el = Self.els.el.find(`ul li[data-id="${w}"]`);
				if (!el.hasClass("expanded")) {
					Self.els.el.find(`li.expanded`).removeClass("expanded");
					el.addClass("expanded");
				}

				// update "solved" attribute
				el.data({ solved: Math.max(+el.data("solved"), l) });

				// update menu
				xNode = window.bluePrint.selectSingleNode(`//Menu[@worldId="${w}"]`);
				if (xNode) xNode.removeAttribute("disabled");
				// update level
				xNode = window.bluePrint.selectSingleNode(`//Menu[@levelId="${w}.${l}"]`);
				window.bluePrint.selectNodes(`//Menu[@check-group="active-level"]`).map(x => x.removeAttribute("is-checked"));
				if (xNode) {
					xNode.removeAttribute("disabled");
					xNode.setAttribute("is-checked", "1");
				}
				break;
			// custom events
			case "apply-saved-state":
				// exit if already rendered progression UI
				if (Self.els.el.find("ul li").length) return;

				let data = [];
				// map out levels
				Game.level.list.map(entry => {
					let [w, i] = entry.split(".").map(i => +i);
					if (!data[w-1]) data[w-1] = [];
					data[w-1].push(i);
				});

				let xProgression = window.bluePrint.selectSingleNode(`//Data/Progression`),
					nodes = data.map((w, i) => {
						let total = Math.max(...w) + 1,
							solved = APP.state.progression[i],
							attr = [`state="locked"`];
						if (solved) attr = [`solved="${solved}"`];
						if ((Self.active.world < 0 && APP.state.progression[i+1] === undefined) || solved === 0) {
							if (attr[0] === `state="locked"`) attr = [];
							attr.push(`state="active"`);
							Self.active.world = i+1;
						}
						// solved percentage
						attr.push(`percent="${Math.round(((solved || 0) / total) * 100)}%"`);
						// update contextmenu
						let xMenu = window.bluePrint.selectSingleNode(`//Menu[@worldId="${i+1}"]`);
						if (solved) {
							// enable "world" menu
							xMenu.removeAttribute("disabled");
							// enable sub-level menus
							w.slice(0, solved+1).map(l => {
								let xLevel = xMenu.selectSingleNode(`./*[@levelId="${i+1}.${l}"]`);
								xLevel.removeAttribute("disabled");
							});
						}
						// "world" node
						return `<World id="${i+1}" total="${total}" ${attr.join(" ")}/>`;
					});
				// console.log( `<data>${nodes.join("\n")}</data>` );

				// insert world nodes into bluePrint "Data"
				$.xmlFromString(`<data>${nodes.join("")}</data>`)
					.selectNodes("/data/World").map(xWorld => xProgression.appendChild(xWorld));

				// complete last active level string
				Self.active.level = APP.state.progression[Self.active.world-1];

				// skip to next world, if all puzzles are solved
				value = `${Self.active.world}.${Self.active.level}`;
				if (!Game.level.list.includes(value)) {
					Self.active.world++;
					Self.active.level = 0;
				}
				// if last level, go to first
				if (!Game.level.list.includes(`${Self.active.world}.${Self.active.level}`)) {
					Self.active.world = 1;
					Self.active.level = 0;
				}

				// render progression nav
				await window.render({
					template: "game-progression",
					match: "//Data/Progression",
					target: Self.els.el,
				});
				// show progression UI
				Self.els.el.addClass("show-up");
				
				if (!event.noJump) {
					// prevent lobby anim
					window.find(".start-view").addClass("no-anim");
					// auto jump to "latest" level
					Game.dispatch({ type: "render-level", arg: `${Self.active.world}.${Self.active.level}` });
				}
				break;
			case "progress-power-up":
				// check if progressed
				value = await Self.dispatch({ type: "serialize-progress" });
				if (value.join() === APP.state.progression.join()) return;
				// update game state
				APP.state.progression = value;

				// flash progression
				Self.els.el.find("li.expanded")
					.cssSequence("power-up", "animationend", el => {
						// reset element
						el.removeClass("power-up");

						let xWorld = window.bluePrint.selectSingleNode(`//Data/Progression/World[@id="${Self.active.world}"]`),
							total = +xWorld.getAttribute("total"),
							wEl = Self.els.el.find(`ul li.expanded`),
							solved = Math.max(+wEl.data("solved"), Self.active.level+1, 0);
						if (Self.active.level < total) {
							Self.active.level++;
							// update progress bar
							wEl.find(`.progress span`).css({ width: Math.round((solved / total) * 100) +"%" });
						} else {
							Self.active.world++;
							Self.active.level = 0;
							// change "expanded"
							wEl.removeClass("expanded");
							wEl = Self.els.el.find(`ul li`).get(Self.active.world-1).addClass("expanded");
						}
						wEl.data({ solved });
					});
				break;
			case "enable-all-puzzles":
				window.bluePrint.selectNodes(`//Menu[@disabled]`).map(x => x.removeAttribute("disabled"));
				break;
			case "select-world":
				event.el.find(".expanded").removeClass("expanded");
				el = $(event.target).addClass("expanded");
				// if "last" world, go to last level
				value = el.nextAll("li:not(.disabled)").length
						? `${el.data("id")}.0`
						: `${el.data("id")}.${el.data("solved")}`;
				Game.dispatch({ type: "render-level", arg: value });
				break;
			case "serialize-progress":
				value = Self.els.el.find("ul li").map(elem => +elem.getAttribute("data-solved")).filter(i => i);
				// console.log(value);
				return value;
		}
	}
}
