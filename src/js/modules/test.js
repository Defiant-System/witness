
let Test = {
	init(APP) {
		// console.log( window.bluePrint.selectNodes(`//Level`).length );
		return;

		
		APP.progression.dispatch({ type: "enable-all-puzzles" });

		setTimeout(() => {
				// Game.dispatch({ type: "render-level", arg: "5.17" });
			Game.dispatch({ type: "render-level", arg: "7.11" });
		}, 200);


		return 
		

		// APP.dispatch({ type: "open-help" });
		
		setTimeout(() => {
			Game.dispatch({ type: "render-level", arg: "4.17" });
			// APP.progression.dispatch({ type: "serialize-progress" });
		}, 200);

		// return;

		// temp
		// window.find(".start-view").addClass("no-anim");
		

		// Game.dispatch({ type: "render-level", arg: "0.2" });
		// Game.dispatch({ type: "render-level", arg: "6.20" });
		// return;

		setTimeout(() => {
			APP.edit.dispatch({ type: "toggle-edit-view" });
			return;
			
			APP.edit.els.el.find(`.option-buttons_ span[data-arg="start"]`).trigger("click");

			setTimeout(() => {
				window.find(`.we[style*="--x: 0;--y: 3;"]`).trigger("click");
				window.find(`.we[style="--x: 0;--y: 2;"]`).append(`<i class="hex middle"></i>`);
				window.find(`.we[style="--x: 1;--y: 2;"]`).append(`<i class="hex top"></i>`);
				window.find(`.ns[style="--x: 1;--y: 2;"]`).append(`<i class="hex middle"></i>`);
			}, 500);
			setTimeout(() => APP.edit.els.el.find(`.option-buttons_ span[data-arg="disjoint"]`).trigger("click"), 600);
		}, 500);

		// setTimeout(() => window.find(`.ns[data-junction="46"] .edit-head`).trigger("click"), 600);
		return;


		return setTimeout(() => {
			window.find(".puzzle svg").replace(`<svg width="102" height="185"><g transform="translate(9,9)"><g class="path1">
							<circle cx="0" cy="83" r="23.75"></circle>
							<line x1="0" y1="83" x2="0" y2="166" stroke-width="20" stroke-linecap="round"></line>
							<line x1="0" y1="166" x2="83" y2="166" stroke-width="20" stroke-linecap="round"></line>
							<line x1="83" y1="83" x2="83" y2="166" stroke-width="20" stroke-linecap="round"></line>
							<line x1="83" y1="83" x2="103" y2="83" stroke-width="20" stroke-linecap="round"></line>
						</g></g></svg>`);

			let el = window.find(".game-view .level .puzzle"),
				snake = { snakeEl: window.find("svg g.path1")[0] };
			Particles.start({ el, snake });
		}, 100);
	}
};

