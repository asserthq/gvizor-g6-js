const g6 = window.G6;

var inputType = "string";
var stepped = 0, rowCount = 0, errorCount = 0, firstError;
var start, end;
var firstRun = true;
var maxUnparseLength = 10000;

$(function()
{
	// Tabs
	$('#tab-string').click(function()
	{
		$('.tab').removeClass('active');
		$(this).addClass('active');
		$('.input-area').hide();
		$('#input-string').show();
		$('#submit').text("Parse & Render");
		inputType = "string";
	});

	$('#tab-local').click(function()
	{
		$('.tab').removeClass('active');
		$(this).addClass('active');
		$('.input-area').hide();
		$('#input-local').show();
		$('#submit').text("Parse & Render");
		inputType = "local";
	});

	$('#tab-remote').click(function()
	{
		$('.tab').removeClass('active');
		$(this).addClass('active');
		$('.input-area').hide();
		$('#input-remote').show();
		$('#submit').text("Parse & Render");
		inputType = "remote";
	});

	$('#tab-unparse').click(function()
	{
		$('.tab').removeClass('active');
		$(this).addClass('active');
		$('.input-area').hide();
		$('#input-unparse').show();
		$('#submit').text("Unparse");
		inputType = "json";
	});



	// Sample files
	$('#remote-normal-file').click(function() {
		$('#url').val($('#local-normal-file').attr('href'));
	});
	$('#remote-large-file').click(function() {
		$('#url').val($('#local-large-file').attr('href'));
	});
	$('#remote-malformed-file').click(function() {
		$('#url').val($('#local-malformed-file').attr('href'));
	});




	// Demo invoked
	$('#submit').click(function()
	{
		if ($(this).prop('disabled') == "true")
			return;

		stepped = 0;
		rowCount = 0;
		errorCount = 0;
		firstError = undefined;

		var config = buildConfig();
		var input = $('#input').val();

		if (inputType == "remote")
			input = $('#url').val();
		else if (inputType == "json")
			input = $('#json').val();

		// Allow only one parse at a time
		$(this).prop('disabled', true);

		if (!firstRun)
			console.log("--------------------------------------------------");
		else
			firstRun = false;



		if (inputType == "local")
		{
			if (!$('#files')[0].files.length)
			{
				alert("Please choose at least one file to parse.");
				return enableButton();
			}
			
			$('#files').parse({
				config: config,
				before: function(file, inputElem)
				{
					start = now();
					console.log("Parsing file...", file);
				},
				error: function(err, file)
				{
					console.log("ERROR:", err, file);
					firstError = firstError || err;
					errorCount++;
				},
				complete: function()
				{
					end = now();
					printStats("Done with all files");
				}
			});
		}
		else if (inputType == "json")
		{
			if (!input)
			{
				alert("Please enter a valid JSON string to convert to CSV.");
				return enableButton();
			}

			start = now();
			var csv = Papa.unparse(input, config);
			end = now();

			console.log("Unparse complete");
			console.log("Time:", (end-start || "(Unknown; your browser does not support the Performance API)"), "ms");
			
			if (csv.length > maxUnparseLength)
			{
				csv = csv.substr(0, maxUnparseLength);
				console.log("(Results truncated for brevity)");
			}

			console.log(csv);

			setTimeout(enableButton, 100);	// hackity-hack
		}
		else if (inputType == "remote" && !input)
		{
			alert("Please enter the URL of a file to download and parse.");
			return enableButton();
		}
		else
		{
			start = now();
			var results = Papa.parse(input, config);
			console.log("Synchronous results:", results);
			if (config.worker || config.download)
				console.log("Running...");
		}
	});

	$('#insert-tab').click(function()
	{
		$('#delimiter').val('\t');
	});
});


//fuction getConfig()

function printStats(msg)
{
	if (msg)
		console.log(msg);
	console.log("       Time:", (end-start || "(Unknown; your browser does not support the Performance API)"), "ms");
	console.log("  Row count:", rowCount);
	if (stepped)
		console.log("    Stepped:", stepped);
	console.log("     Errors:", errorCount);
	if (errorCount)
		console.log("First error:", firstError);
}



function buildConfig()
{
	return {
		delimiter: $('#delimiter').val(),
		header: $('#header').prop('checked'),
		dynamicTyping: $('#dynamicTyping').prop('checked'),
		skipEmptyLines: $('#skipEmptyLines').prop('checked'),
		preview: parseInt($('#preview').val() || 0),
		step: $('#stream').prop('checked') ? stepFn : undefined,
		encoding: $('#encoding').val(),
		worker: $('#worker').prop('checked'),
		comments: $('#comments').val(),
		complete: completeFn,
		error: errorFn,
		download: inputType == "remote"
	};
}

function stepFn(results, parser)
{
	stepped++;
	if (results)
	{
		if (results.data)
			rowCount += results.data.length;
		if (results.errors)
		{
			errorCount += results.errors.length;
			firstError = firstError || results.errors[0];
		}
	}
}

function completeFn(results)
{
	end = now();

	if (results && results.errors)
	{
		if (results.errors)
		{
			errorCount = results.errors.length;
			firstError = results.errors[0];
		}
		if (results.data && results.data.length > 0)
			rowCount = results.data.length;
	}

	printStats("Parse complete");
	console.log("    Results:", results);

	drawGraph(results);
	
	// icky hack
	setTimeout(enableButton, 100);
}

function errorFn(err, file)
{
	end = now();
	console.log("ERROR:", err, file);
	enableButton();
}

function enableButton()
{
	$('#submit').prop('disabled', false);
}

function now()
{
	return typeof window.performance !== 'undefined'
			? window.performance.now()
			: 0;
}





function drawGraph(parseResults) {

	const data = ('fields' in parseResults.meta) 
	    ? buildGraphDataWithHeaders(parseResults.data, parseResults.meta.fields)
		: buildGraphData(parseResults.data);

	const graph = new g6.Graph({
		container: 'graph_container',
		data: data,
		node: {
			style: {
			  labelText: (n) => n.id,
			  ports: [],
			}
		},
		layout: {
			type: 'fruchterman',
			linkDistance: 300,
			workerEnabled: true,
    		maxIteration: 20
		},
		behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element']
	});

	console.log(data);

	graph.render();
}

function buildGraphDataWithHeaders(csvArr, headers) {

	let data = {
		nodes: [],
		edges: []
	}

	headers.forEach((nodeId, i) => {
		if (i > 0) {
			data.nodes.push({ id: nodeId, label: 'lll' });
		}
	});

	csvArr.forEach((rowObj, r) => {
		Object.keys(rowObj).forEach((nodeTo, c) => {
			if (c > 0 && r != c - 1 && rowObj[nodeTo] == '1') {
				data.edges.push({
					source: data.nodes[r].id,
					target: nodeTo
				});
			}
		});
	});

	return data;
}

function buildGraphData(csvMat) {

	let data = {
		nodes: [],
		edges: []
	}

	for (r = 0; r < csvMat.length; r++) {
		data.nodes.push({ id: csvMat[r][0], label: 'lll' });
	}

	for (r = 0; r < csvMat.length; r++) {
		for (c = 1; c < csvMat[r].length; c++) {
			if (r != (c - 1)) {
				let edge = {
					style: {
						startArrow: true,
						lineWidth: 2
					}
				};
				if (csvMat[r][c] > 0) {
					edge.source = csvMat[r][0];
					edge.target = csvMat[c - 1][0];
					edge.style.stroke = "#ff0000";
					data.edges.push(edge);
					
				} else if (csvMat[r][c] < 0) {
					edge.source = csvMat[c - 1][0];
					edge.target = csvMat[r][0];
					edge.style.stroke = "#0000ff";
					data.edges.push(edge);
				}
			} 
		}
	}

	return data;
}