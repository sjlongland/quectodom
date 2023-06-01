/*
 * Copyright © 2023 Stuart Longland
 * 
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * Retrieve the URI of the page currently loaded.
 */
function getPageURI() {
	let uri = window.location.toString();

	if (uri.substring(uri.length-1) != "/") {
		let parts = uri.split("/");
		parts[parts.length - 1] = "";
		uri = parts.join("/");
	}

	return uri;
}

/**
 * Fetch a resource over HTTP, return the `XMLHttpRequest` object
 * that returns it.  On error, raise the error and attach the
 * `XMLHttpRequest` object to its `xhr` property.
 */
function request(method, uri) {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open(method, uri);
		xhr.addEventListener("load", () => {
			resolve(xhr);
		});
		xhr.addEventListener("error", (err) => {
			err.xhr = xhr;
			reject(err);
		});
		xhr.send();
	});
}

/**
 * Fetch a JSON document over HTTP, return the decoded JSON.
 */
async function requestJSON(method, uri) {
	const xhr = await request(method, uri);
	return JSON.parse(xhr.responseText);
}

/**
 * Return the appropriate sign for the given value.
 *
 * @param	val	The number to test
 * @param	minus	Symbol to emit if negative
 * @param	zero	Symbol to emit if zero
 * @param	plus	Symbol to emit if positive
 */
function getSignOf(val, minus="-", zero="", plus="") {
	if (val < 0) {
		return minus;
	} else if (val === 0) {
		return zero;
	} else {
		return plus;
	}
}

/**
 * Format an integer, padding with zeros to ensure expected width.
 * Length may be one more than digits if negative.
 *
 * @param	val	The number to format
 * @param	digits	The number of digits to format to
 * @param	minus	Symbol to emit if negative
 * @param	zero	Symbol to emit if zero
 * @param	plus	Symbol to emit if positive
 */
function formatInt(val, digits, minus="-", zero="", plus="") {
	const sign = getSignOf(val, minus, zero, plus);
	let str = Math.abs(val).toString();
	while (str.length < digits) {
		str = "0" + str;
	}
	return sign + str;
}

/**
 * Format a float, padding with zeros to ensure expected width.
 * Length may be one more than digits if negative.
 *
 * @param	val		The float being formatted
 * @param	places		Number of digits after the decimal point
 * @param	digits		Number of integer digits before the decimal point
 * @param	frac_sep	Fractional separator, typically "." or ",".
 * @param	minus		Symbol to emit if negative
 * @param	zero		Symbol to emit if zero
 * @param	plus		Symbol to emit if positive
 */
function formatFloat(val, places, digits=null, frac_sep=".", minus="-", zero="", plus="") {
	const sign = getSignOf(val, minus, zero, plus);
	val = Math.abs(val);
	const whole = Math.floor(val);
	const frac = Math.floor(
		((val - whole) * Math.pow(10, places))
		+ 0.5
	);
	return (
		sign
		+ (digits ? formatInt(whole, digits) : whole.toString())
		+ frac_sep
		+ formatInt(frac, places)
	);
}

/**
 * Format a float with a unit.
 */
function formatUnit(val, unit, places=3, digits=null, frac_sep=".", minus="-", zero="", plus="") {
	val = formatFloat(val, places, digits, frac_sep, minus, zero, plus);
	if (unit) {
		val += " " + unit;
	}
	return val;
}

/**
 * Format the time part of a date/time string
 */
function formatTime(dstr) {
	const date = new Date(dstr);
	return formatInt(date.getHours(), 2)
		+ ":"
		+ formatInt(date.getMinutes(), 2);
}

/**
 * Fetch a resource and cache it for a given period.
 */
class CachedFile {
	constructor(method, uri, cache_duration=86400000) {
		this._method = method;
		this._uri = uri;
		this._cache_duration = cache_duration;
		this._expiry = 0;
		this._data = null;
	}

	async get(force=false) {
		if (force || (this._expiry < Date.now())) {
			const data = await requestJSON(
				this._method, this._uri
			);
			this._data = data;
			this._expiry = Date.now() + this._cache_duration;
		}
		return this._data;
	}
}

/**
 * Simple wrapper around a DOM node.  This class presents a "literate"
 * interface to the DOM to enable quick creation of DOM nodes and
 * interacting with their properties.
 *
 * The DOM node itself is directly accessible via the `element` property
 * in the event that the wrapper doesn't provide access to some DOM feature.
 */
class DOMWrapper {
	constructor(element) {
		this.element = element;
	}

	setId(id) {
		this.element.id = id;
		return this;
	}

	addClasses(...classes) {
		for (const cls of classes) {
			if (cls) this.element.classList.add(cls);
		}
		return this;
	}

	rmClasses(...classes) {
		for (const cls of classes) {
			if (cls) this.element.classList.remove(cls);
		}
		return this;
	}
}

/**
 * Wrapper for a DOM node that can contain children (i.e. an Element).
 */
class ParentWrapper extends DOMWrapper {
	/** Delete all elements from the parent */
	clear() {
		while (this.element.children.length > 0) {
			this.element.removeChild(this.element.children[0]);
		}

		return this;
	}

	/** Append new children to the parent */
	append(...children) {
		for (let child of children) {
			if (child == null) {
				/* Shortcut, create a blank node */
				child = new TextNodeWrapper();
			} else if (typeof(child) !== "object") {
				/* Shortcut: create a text node */
				child = new TextNodeWrapper(child.toString());
			}

			this.element.appendChild(child.element);
		}

		return this;
	}
}

/**
 * Wrapper around a text node, the `text` property is a quick
 * way to update the element's content.
 */
class TextNodeWrapper extends DOMWrapper {
	constructor(text=null) {
		super(document.createTextNode(text || ""));
	}

	get text() {
		return this.element.textContent;
	}

	set text(text) {
		this.element.textContent = text;
	}

	setText(text) {
		this.text = text;
		return this;
	}
}

/**
 * Wrapper around an Element.  This provides a literate interface to
 * interacting with the element's attributes.
 */
class ElementWrapper extends ParentWrapper {
	constructor(tag) {
		super(document.createElement(tag));
	}

	attribute(attr, value) {
		if (value != null) {
			this.element.setAttribute(attr, value);
		} else {
			this.element.removeAttribute(attr);
		}

		return this;
	}
}

/**
 * Table generation helper.  Generates the basic table structure and
 * provides easy access to the header and body elements.
 */
class TableMaker extends DOMWrapper {
	constructor(...headings) {
		const table = new ElementWrapper("table");
		super(table.element);

		this.table = table;
		this.thead = new ElementWrapper("thead");
		this.tbody = new ElementWrapper("tbody");

		this.headings_by_name = {};
		this.headings = [];

		const headrow = new ElementWrapper("tr");
		for (let i = 0; i < headings.length; i++) {
			const {name, label} = headings[i];
			const th_label = new TextNodeWrapper(label);
			const th = new ElementWrapper("th").append(th_label);
			const h = {
				name: name,
				pos: i,
				label: th_label,
				th: th
			}
			this.headings_by_name[name] = h;
			this.headings.push(h);
			headrow.append(th);
		}

		this.thead.append(headrow);
		table.append(this.thead, this.tbody);
	}

	appendRows(...rows) {
		for (const row of rows) {
			const tr = new ElementWrapper("tr");
			for (const col of this.headings) {
				const cell = new ElementWrapper("td");
				if (row.hasOwnProperty(col.name)) {
					const cellvalue = row[col.name];
					if (
						(cellvalue != null)
					&& (typeof(cellvalue) === "object")
					&& (!(cellvalue instanceof DOMWrapper))
					) {
						if (cellvalue.classes) {
							cell.addClasses(...cellvalue.classes);
						}
						cell.append(cellvalue.content);
					} else {
						cell.append(cellvalue);
					}
				} else {
					cell.append("");
				}
				tr.append(cell);
			}
			this.tbody.append(tr);
		}
		return this;
	}
}
