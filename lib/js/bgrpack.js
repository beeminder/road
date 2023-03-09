;((function (root, factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    //console.log("Polyfit: Using AMD module definition")
    define([], factory)
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.    
    //console.log("Polyfit: Using CommonJS module.exports")
    module.exports = factory()
  } else {
    //console.log("Polyfit: Using Browser globals")
    root.Polyfit = factory()
  }
})(this, function () {
  'use strict'

  /**
   * Polyfit
   * @constructor
   * @param {number[]|Float32Array|Float64Array} x
   * @param {number[]|Float32Array|Float64Array} y
   */
  function Polyfit(x, y) {
    var self = this;

    // Check that x any y are both arrays of the same type
    if (!((x instanceof Array && y instanceof Array) ||
          (x instanceof Float32Array && y instanceof Float32Array) ||
          (x instanceof Float64Array && y instanceof Float64Array))) {
      throw new Error('x and y must be arrays');
    }
    if (x instanceof Float32Array) {
      this.FloatXArray = Float32Array;
    }
    else if (x instanceof Float64Array) {
      this.FloatXArray = Float64Array;
    }
    // Make sure we have equal lengths
    if (x.length !== y.length) {
      throw new Error('x and y must have the same length');
    }
    this.x = x;
    this.y = y;

    /**
     * Perform gauss-jordan division
     *
     * @param {number[][]|Float32Array[]|Float64Array[]} matrix - gets modified
     * @param {number} row
     * @param {number} col
     * @param {number} numCols
     * @returns void
     */
    const gaussJordanDivide = function (matrix, row, col, numCols) {
        for (var i = col + 1; i < numCols; i++) {
            matrix[row][i] /= matrix[row][col];
        }
        matrix[row][col] = 1;
    };
    /**
     * Perform gauss-jordan elimination
     *
     * @param {number[][]|Float64Array[]} matrix - gets modified
     * @param {number} row
     * @param {number} col
     * @param {number} numRows
     * @param {number} numCols
     * @returns void
     */
    const gaussJordanEliminate = function (matrix, row, col, numRows, numCols) {
        for (var i = 0; i < numRows; i++) {
            if (i !== row && matrix[i][col] !== 0) {
                for (var j = col + 1; j < numCols; j++) {
                    matrix[i][j] -= matrix[i][col] * matrix[row][j];
                }
                matrix[i][col] = 0;
            }
        }
    };
    /**
     * Perform gauss-jordan echelon method
     *
     * @param {number[][]|Float32Array[]|Float64Array[]} matrix - gets modified
     * @returns {number[][]|Float32Array[]|Float64Array[]} matrix
     */
    const gaussJordanEchelonize = function (matrix) {
        var rows = matrix.length;
        var cols = matrix[0].length;
        var i = 0;
        var j = 0;
        var k;
        var swap;
        while (i < rows && j < cols) {
            k = i;
            // Look for non-zero entries in col j at or below row i
            while (k < rows && matrix[k][j] === 0) {
                k++;
            }
            // If an entry is found at row k
            if (k < rows) {
                // If k is not i, then swap row i with row k
                if (k !== i) {
                    swap = matrix[i];
                    matrix[i] = matrix[k];
                    matrix[k] = swap;
                }
                // If matrix[i][j] is != 1, divide row i by matrix[i][j]
                if (matrix[i][j] !== 1) {
                    gaussJordanDivide(matrix, i, j, cols);
                }
                // Eliminate all other non-zero entries
                gaussJordanEliminate(matrix, i, j, rows, cols);
                i++;
            }
            j++;
        }
        return matrix;
    };
    /**
     * Perform regression
     *
     * @param {number} x
     * @param {number[]|Float32Array[]|Float64Array[]} terms
     * @returns {number}
     */
    const regress = function (x, terms) {
        var a = 0;
        var exp = 0;
        for (var i = 0, len = terms.length; i < len; i++) {
            a += terms[i] * Math.pow(x, exp++);
        }
        return a;
    };
    /**
     * Compute correlation coefficient
     *
     * @param {number[]|Float32Array[]|Float64Array[]} terms
     * @returns {number}
     */
    Polyfit.prototype.correlationCoefficient = function (terms) {
        var r = 0;
        var n = this.x.length;
        var sx = 0;
        var sx2 = 0;
        var sy = 0;
        var sy2 = 0;
        var sxy = 0;
        var x;
        var y;
        for (var i = 0; i < n; i++) {
            x = regress(this.x[i], terms);
            y = this.y[i];
            sx += x;
            sy += y;
            sxy += x * y;
            sx2 += x * x;
            sy2 += y * y;
        }
        var div = Math.sqrt((sx2 - (sx * sx) / n) * (sy2 - (sy * sy) / n));
        if (div !== 0) {
            r = Math.pow((sxy - (sx * sy) / n) / div, 2);
        }
        return r;
    };
    /**
     * Run standard error function
     *
     * @param {number[]|Float32Array[]|Float64Array[]} terms
     * @returns number
     */
    Polyfit.prototype.standardError = function (terms) {
        var r = 0;
        var n = this.x.length;
        if (n > 2) {
            var a = 0;
            for (var i = 0; i < n; i++) {
                a += Math.pow((regress(this.x[i], terms) - this.y[i]), 2);
            }
            r = Math.sqrt(a / (n - 2));
        }
        return r;
    };
    /**
     * Compute coefficients for given data matrix
     *
     * @param {number} p
     * @returns {number[]|Float32Array|Float64Array}
     */
    Polyfit.prototype.computeCoefficients = function (p) {
        var n = this.x.length;
        var r;
        var c;
        var rs = 2 * (++p) - 1;
        var i;
        var m = [];
        // Initialize array with 0 values
        if (this.FloatXArray) {
            // fast FloatXArray-Matrix init
            var bytesPerRow = (p + 1) * this.FloatXArray.BYTES_PER_ELEMENT;
            var buffer = new ArrayBuffer(p * bytesPerRow);
            for (i = 0; i < p; i++) {
                m[i] = new this.FloatXArray(buffer, i * bytesPerRow, p + 1);
            }
        }
        else {
            var zeroRow = [];
            for (i = 0; i <= p; i++) {
                zeroRow[i] = 0;
            }
            m[0] = zeroRow;
            for (i = 1; i < p; i++) {
                // copy zeroRow
                m[i] = zeroRow.slice();
            }
        }
        var mpc = [n];
        for (i = 1; i < rs; i++) {
            mpc[i] = 0;
        }
        for (i = 0; i < n; i++) {
            var x = this.x[i];
            var y = this.y[i];
            // Process precalculation array
            for (r = 1; r < rs; r++) {
                mpc[r] += Math.pow(x, r);
            }
            // Process RH column cells
            m[0][p] += y;
            for (r = 1; r < p; r++) {
                m[r][p] += Math.pow(x, r) * y;
            }
        }
        // Populate square matrix section
        for (r = 0; r < p; r++) {
            for (c = 0; c < p; c++) {
                m[r][c] = mpc[r + c];
            }
        }
        gaussJordanEchelonize(m);
        var terms = this.FloatXArray && new this.FloatXArray(m.length) || [];
        for (i = m.length - 1; i >= 0; i--) {
            terms[i] = m[i][p];
        }
        return terms;
    };
    /**
     * Using given degree of fitment, return a function that will calculate
     * the y for a given x
     *
     * @param {number} degree  > 0
     * @returns {Function}     f(x) =
     */
    Polyfit.prototype.getPolynomial = function (degree) {
        if (isNaN(degree) || degree < 0) {
            throw new Error('Degree must be a positive integer');
        }
        var terms = this.computeCoefficients(degree);
        var eqParts = [];
        eqParts.push(terms[0].toPrecision());
        for (var i = 1, len = terms.length; i < len; i++) {
            eqParts.push(terms[i] + ' * Math.pow(x, ' + i + ')');
        }
        var expr = 'return ' + eqParts.join(' + ') + ';';
        /* jshint evil: true */
        return new Function('x', expr);
        /* jshint evil: false */
    };
    /**
     * Convert the polynomial to a string expression, mostly useful for visual
     * debugging
     *
     * @param {number} degree
     * @returns {string}
     */
    Polyfit.prototype.toExpression = function (degree) {
        if (isNaN(degree) || degree < 0) {
            throw new Error('Degree must be a positive integer');
        }
        var terms = this.computeCoefficients(degree);
        var eqParts = [];
        var len = terms.length;
        eqParts.push(terms[0].toPrecision());
        for (var i = 1; i < len; i++) {
            eqParts.push(terms[i] + 'x^' + i);
        }
        return eqParts.join(' + ');
    };
  }

  return Polyfit;
}));

/*!
 * Pikaday
 *
 * Copyright © 2014 David Bushell | BSD & MIT license | https://github.com/dbushell/Pikaday
 */

(function (root, factory)
{
    'use strict';

    var moment;
    if (typeof exports === 'object') {
        // CommonJS module
        // Load moment.js as an optional dependency
        try { moment = require('moment'); } catch (e) {}
        module.exports = factory(moment);
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(function (req)
        {
            // Load moment.js as an optional dependency
            var id = 'moment';
            try { moment = req(id); } catch (e) {}
            return factory(moment);
        });
    } else {
        root.Pikaday = factory(root.moment);
    }
}(this, function (moment)
{
    'use strict';

    /**
     * feature detection and helper functions
     */
    var hasMoment = typeof moment === 'function',

    hasEventListeners = !!window.addEventListener,

    document = window.document,

    sto = window.setTimeout,

    addEvent = function(el, e, callback, capture)
    {
        if (hasEventListeners) {
            el.addEventListener(e, callback, !!capture);
        } else {
            el.attachEvent('on' + e, callback);
        }
    },

    removeEvent = function(el, e, callback, capture)
    {
        if (hasEventListeners) {
            el.removeEventListener(e, callback, !!capture);
        } else {
            el.detachEvent('on' + e, callback);
        }
    },

    trim = function(str)
    {
        return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g,'');
    },

    hasClass = function(el, cn)
    {
        return (' ' + el.className + ' ').indexOf(' ' + cn + ' ') !== -1;
    },

    addClass = function(el, cn)
    {
        if (!hasClass(el, cn)) {
            el.className = (el.className === '') ? cn : el.className + ' ' + cn;
        }
    },

    removeClass = function(el, cn)
    {
        el.className = trim((' ' + el.className + ' ').replace(' ' + cn + ' ', ' '));
    },

    isArray = function(obj)
    {
        return (/Array/).test(Object.prototype.toString.call(obj));
    },

    isDate = function(obj)
    {
        return (/Date/).test(Object.prototype.toString.call(obj)) && !isNaN(obj.getTime());
    },

    isWeekend = function(date)
    {
        var day = date.getDay();
        return day === 0 || day === 6;
    },

    isLeapYear = function(year)
    {
        // solution by Matti Virkkunen: http://stackoverflow.com/a/4881951
        return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
    },

    getDaysInMonth = function(year, month)
    {
        return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
    },

    setToStartOfDay = function(date)
    {
        if (isDate(date)) date.setHours(0,0,0,0);
    },

    compareDates = function(a,b)
    {
        // weak date comparison (use setToStartOfDay(date) to ensure correct result)
        return a.getTime() === b.getTime();
    },

    extend = function(to, from, overwrite)
    {
        var prop, hasProp;
        for (prop in from) {
            hasProp = to[prop] !== undefined;
            if (hasProp && typeof from[prop] === 'object' && from[prop] !== null && from[prop].nodeName === undefined) {
                if (isDate(from[prop])) {
                    if (overwrite) {
                        to[prop] = new Date(from[prop].getTime());
                    }
                }
                else if (isArray(from[prop])) {
                    if (overwrite) {
                        to[prop] = from[prop].slice(0);
                    }
                } else {
                    to[prop] = extend({}, from[prop], overwrite);
                }
            } else if (overwrite || !hasProp) {
                to[prop] = from[prop];
            }
        }
        return to;
    },

    fireEvent = function(el, eventName, data)
    {
        var ev;

        if (document.createEvent) {
            ev = document.createEvent('HTMLEvents');
            ev.initEvent(eventName, true, false);
            ev = extend(ev, data);
            el.dispatchEvent(ev);
        } else if (document.createEventObject) {
            ev = document.createEventObject();
            ev = extend(ev, data);
            el.fireEvent('on' + eventName, ev);
        }
    },

    adjustCalendar = function(calendar) {
        if (calendar.month < 0) {
            calendar.year -= Math.ceil(Math.abs(calendar.month)/12);
            calendar.month += 12;
        }
        if (calendar.month > 11) {
            calendar.year += Math.floor(Math.abs(calendar.month)/12);
            calendar.month -= 12;
        }
        return calendar;
    },

    /**
     * defaults and localisation
     */
    defaults = {

        // bind the picker to a form field
        field: null,

        // automatically show/hide the picker on `field` focus (default `true` if `field` is set)
        bound: undefined,

        // position of the datepicker, relative to the field (default to bottom & left)
        // ('bottom' & 'left' keywords are not used, 'top' & 'right' are modifier on the bottom/left position)
        position: 'bottom left',

        // automatically fit in the viewport even if it means repositioning from the position option
        reposition: true,

        // the default output format for `.toString()` and `field` value
        format: 'YYYY-MM-DD',

        // the toString function which gets passed a current date object and format
        // and returns a string
        toString: null,

        // used to create date object from current input string
        parse: null,

        // the initial date to view when first opened
        defaultDate: null,

        // make the `defaultDate` the initial selected value
        setDefaultDate: false,

        // first day of week (0: Sunday, 1: Monday etc)
        firstDay: 0,

        // the default flag for moment's strict date parsing
        formatStrict: false,

        // the minimum/earliest date that can be selected
        minDate: null,
        // the maximum/latest date that can be selected
        maxDate: null,

        // number of years either side, or array of upper/lower range
        yearRange: 10,

        // show week numbers at head of row
        showWeekNumber: false,

        // Week picker mode
        pickWholeWeek: false,

        // used internally (don't config outside)
        minYear: 0,
        maxYear: 9999,
        minMonth: undefined,
        maxMonth: undefined,

        startRange: null,
        endRange: null,

        isRTL: false,

        // Additional text to append to the year in the calendar title
        yearSuffix: '',

        // Render the month after year in the calendar title
        showMonthAfterYear: false,

        // Render days of the calendar grid that fall in the next or previous month
        showDaysInNextAndPreviousMonths: false,

        // Allows user to select days that fall in the next or previous month
        enableSelectionDaysInNextAndPreviousMonths: false,

        // how many months are visible
        numberOfMonths: 1,

        // when numberOfMonths is used, this will help you to choose where the main calendar will be (default `left`, can be set to `right`)
        // only used for the first display or when a selected date is not visible
        mainCalendar: 'left',

        // Specify a DOM element to render the calendar in
        container: undefined,

        // Blur field when date is selected
        blurFieldOnSelect : true,

        // internationalization
        i18n: {
            previousMonth : 'Previous Month',
            nextMonth     : 'Next Month',
            months        : ['January','February','March','April','May','June','July','August','September','October','November','December'],
            weekdays      : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
            weekdaysShort : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
        },

        // Theme Classname
        theme: null,

        // events array
        events: [],

        // callback function
        onSelect: null,
        onOpen: null,
        onClose: null,
        onDraw: null
    },


    /**
     * templating functions to abstract HTML rendering
     */
    renderDayName = function(opts, day, abbr)
    {
        day += opts.firstDay;
        while (day >= 7) {
            day -= 7;
        }
        return abbr ? opts.i18n.weekdaysShort[day] : opts.i18n.weekdays[day];
    },

    renderDay = function(opts)
    {
        var arr = [];
        var ariaSelected = 'false';
        if (opts.isEmpty) {
            if (opts.showDaysInNextAndPreviousMonths) {
                arr.push('is-outside-current-month');

                if(!opts.enableSelectionDaysInNextAndPreviousMonths) {
                    arr.push('is-selection-disabled');
                }

            } else {
                return '<td class="is-empty"></td>';
            }
        }
        if (opts.isDisabled) {
            arr.push('is-disabled');
        }
        if (opts.isToday) {
            arr.push('is-today');
        }
        if (opts.isSelected) {
            arr.push('is-selected');
            ariaSelected = 'true';
        }
        if (opts.hasEvent) {
            arr.push('has-event');
        }
        if (opts.isInRange) {
            arr.push('is-inrange');
        }
        if (opts.isStartRange) {
            arr.push('is-startrange');
        }
        if (opts.isEndRange) {
            arr.push('is-endrange');
        }
        return '<td data-day="' + opts.day + '" class="' + arr.join(' ') + '" aria-selected="' + ariaSelected + '">' +
                 '<button class="pika-button pika-day" type="button" ' +
                    'data-pika-year="' + opts.year + '" data-pika-month="' + opts.month + '" data-pika-day="' + opts.day + '">' +
                        opts.day +
                 '</button>' +
               '</td>';
    },

    renderWeek = function (d, m, y) {
        // Lifted from http://javascript.about.com/library/blweekyear.htm, lightly modified.
        var onejan = new Date(y, 0, 1),
            weekNum = Math.ceil((((new Date(y, m, d) - onejan) / 86400000) + onejan.getDay()+1)/7);
        return '<td class="pika-week">' + weekNum + '</td>';
    },

    renderRow = function(days, isRTL, pickWholeWeek, isRowSelected)
    {
        return '<tr class="pika-row' + (pickWholeWeek ? ' pick-whole-week' : '') + (isRowSelected ? ' is-selected' : '') + '">' + (isRTL ? days.reverse() : days).join('') + '</tr>';
    },

    renderBody = function(rows)
    {
        return '<tbody>' + rows.join('') + '</tbody>';
    },

    renderHead = function(opts)
    {
        var i, arr = [];
        if (opts.showWeekNumber) {
            arr.push('<th></th>');
        }
        for (i = 0; i < 7; i++) {
            arr.push('<th scope="col"><abbr title="' + renderDayName(opts, i) + '">' + renderDayName(opts, i, true) + '</abbr></th>');
        }
        return '<thead><tr>' + (opts.isRTL ? arr.reverse() : arr).join('') + '</tr></thead>';
    },

    renderTitle = function(instance, c, year, month, refYear, randId)
    {
        var i, j, arr,
            opts = instance._o,
            isMinYear = year === opts.minYear,
            isMaxYear = year === opts.maxYear,
            html = '<div id="' + randId + '" class="pika-title" role="heading" aria-live="assertive">',
            monthHtml,
            yearHtml,
            prev = true,
            next = true;

        for (arr = [], i = 0; i < 12; i++) {
            arr.push('<option value="' + (year === refYear ? i - c : 12 + i - c) + '"' +
                (i === month ? ' selected="selected"': '') +
                ((isMinYear && i < opts.minMonth) || (isMaxYear && i > opts.maxMonth) ? 'disabled="disabled"' : '') + '>' +
                opts.i18n.months[i] + '</option>');
        }

        monthHtml = '<div class="pika-label">' + opts.i18n.months[month] + '<select class="pika-select pika-select-month" tabindex="-1">' + arr.join('') + '</select></div>';

        if (isArray(opts.yearRange)) {
            i = opts.yearRange[0];
            j = opts.yearRange[1] + 1;
        } else {
            i = year - opts.yearRange;
            j = 1 + year + opts.yearRange;
        }

        for (arr = []; i < j && i <= opts.maxYear; i++) {
            if (i >= opts.minYear) {
                arr.push('<option value="' + i + '"' + (i === year ? ' selected="selected"': '') + '>' + (i) + '</option>');
            }
        }
        yearHtml = '<div class="pika-label">' + year + opts.yearSuffix + '<select class="pika-select pika-select-year" tabindex="-1">' + arr.join('') + '</select></div>';

        if (opts.showMonthAfterYear) {
            html += yearHtml + monthHtml;
        } else {
            html += monthHtml + yearHtml;
        }

        if (isMinYear && (month === 0 || opts.minMonth >= month)) {
            prev = false;
        }

        if (isMaxYear && (month === 11 || opts.maxMonth <= month)) {
            next = false;
        }

        if (c === 0) {
            html += '<button class="pika-prev' + (prev ? '' : ' is-disabled') + '" type="button">' + opts.i18n.previousMonth + '</button>';
        }
        if (c === (instance._o.numberOfMonths - 1) ) {
            html += '<button class="pika-next' + (next ? '' : ' is-disabled') + '" type="button">' + opts.i18n.nextMonth + '</button>';
        }

        return html += '</div>';
    },

    renderTable = function(opts, data, randId)
    {
        return '<table cellpadding="0" cellspacing="0" class="pika-table" role="grid" aria-labelledby="' + randId + '">' + renderHead(opts) + renderBody(data) + '</table>';
    },


    /**
     * Pikaday constructor
     */
    Pikaday = function(options)
    {
        var self = this,
            opts = self.config(options);

        self._onMouseDown = function(e)
        {
            if (!self._v) {
                return;
            }
            e = e || window.event;
            var target = e.target || e.srcElement;
            if (!target) {
                return;
            }

            if (!hasClass(target, 'is-disabled')) {
                if (hasClass(target, 'pika-button') && !hasClass(target, 'is-empty') && !hasClass(target.parentNode, 'is-disabled')) {
                    self.setDate(new Date(target.getAttribute('data-pika-year'), target.getAttribute('data-pika-month'), target.getAttribute('data-pika-day')));
                    if (opts.bound) {
                        sto(function() {
                            self.hide();
                            if (opts.blurFieldOnSelect && opts.field) {
                                opts.field.blur();
                            }
                        }, 100);
                    }
                }
                else if (hasClass(target, 'pika-prev')) {
                    self.prevMonth();
                }
                else if (hasClass(target, 'pika-next')) {
                    self.nextMonth();
                }
            }
            if (!hasClass(target, 'pika-select')) {
                // if this is touch event prevent mouse events emulation
                if (e.preventDefault) {
                    e.preventDefault();
                } else {
                    e.returnValue = false;
                    return false;
                }
            } else {
                self._c = true;
            }
        };

        self._onChange = function(e)
        {
            e = e || window.event;
            var target = e.target || e.srcElement;
            if (!target) {
                return;
            }
            if (hasClass(target, 'pika-select-month')) {
                self.gotoMonth(target.value);
            }
            else if (hasClass(target, 'pika-select-year')) {
                self.gotoYear(target.value);
            }
        };

        self._onKeyChange = function(e)
        {
            e = e || window.event;

            if (self.isVisible()) {

                switch(e.keyCode){
                    case 13:
                    case 27:
                        if (opts.field) {
                            opts.field.blur();
                        }
                        break;
                    case 37:
                        e.preventDefault();
                        self.adjustDate('subtract', 1);
                        break;
                    case 38:
                        self.adjustDate('subtract', 7);
                        break;
                    case 39:
                        self.adjustDate('add', 1);
                        break;
                    case 40:
                        self.adjustDate('add', 7);
                        break;
                }
            }
        };

        self._onInputChange = function(e)
        {
            var date;

            if (e.firedBy === self) {
                return;
            }
            if (opts.parse) {
                date = opts.parse(opts.field.value, opts.format);
            } else if (hasMoment) {
                date = moment(opts.field.value, opts.format, opts.formatStrict);
                date = (date && date.isValid()) ? date.toDate() : null;
            }
            else {
                date = new Date(Date.parse(opts.field.value));
            }
            if (isDate(date)) {
              self.setDate(date);
            }
            if (!self._v) {
                self.show();
            }
        };

        self._onInputFocus = function()
        {
            self.show();
        };

        self._onInputClick = function()
        {
            self.show();
        };

        self._onInputBlur = function()
        {
            // IE allows pika div to gain focus; catch blur the input field
            var pEl = document.activeElement;
            do {
                if (hasClass(pEl, 'pika-single')) {
                    return;
                }
            }
            while ((pEl = pEl.parentNode));

            if (!self._c) {
                self._b = sto(function() {
                    self.hide();
                }, 50);
            }
            self._c = false;
        };

        self._onClick = function(e)
        {
            e = e || window.event;
            var target = e.target || e.srcElement,
                pEl = target;
            if (!target) {
                return;
            }
            if (!hasEventListeners && hasClass(target, 'pika-select')) {
                if (!target.onchange) {
                    target.setAttribute('onchange', 'return;');
                    addEvent(target, 'change', self._onChange);
                }
            }
            do {
                if (hasClass(pEl, 'pika-single') || pEl === opts.trigger) {
                    return;
                }
            }
            while ((pEl = pEl.parentNode));
            if (self._v && target !== opts.trigger && pEl !== opts.trigger) {
                self.hide();
            }
        };

        self.el = document.createElement('div');
        self.el.className = 'pika-single' + (opts.isRTL ? ' is-rtl' : '') + (opts.theme ? ' ' + opts.theme : '');

        addEvent(self.el, 'mousedown', self._onMouseDown, true);
        addEvent(self.el, 'touchend', self._onMouseDown, true);
        addEvent(self.el, 'change', self._onChange);
        addEvent(document, 'keydown', self._onKeyChange);

        if (opts.field) {
            if (opts.container) {
                opts.container.appendChild(self.el);
            } else if (opts.bound) {
                document.body.appendChild(self.el);
            } else {
                opts.field.parentNode.insertBefore(self.el, opts.field.nextSibling);
            }
            addEvent(opts.field, 'change', self._onInputChange);

            if (!opts.defaultDate) {
                if (hasMoment && opts.field.value) {
                    opts.defaultDate = moment(opts.field.value, opts.format).toDate();
                } else {
                    opts.defaultDate = new Date(Date.parse(opts.field.value));
                }
                opts.setDefaultDate = true;
            }
        }

        var defDate = opts.defaultDate;

        if (isDate(defDate)) {
            if (opts.setDefaultDate) {
                self.setDate(defDate, true);
            } else {
                self.gotoDate(defDate);
            }
        } else {
            self.gotoDate(new Date());
        }

        if (opts.bound) {
            this.hide();
            self.el.className += ' is-bound';
            addEvent(opts.trigger, 'click', self._onInputClick);
            addEvent(opts.trigger, 'focus', self._onInputFocus);
            addEvent(opts.trigger, 'blur', self._onInputBlur);
        } else {
            this.show();
        }
    };


    /**
     * public Pikaday API
     */
    Pikaday.prototype = {


        /**
         * configure functionality
         */
        config: function(options)
        {
            if (!this._o) {
                this._o = extend({}, defaults, true);
            }

            var opts = extend(this._o, options, true);

            opts.isRTL = !!opts.isRTL;

            opts.field = (opts.field && opts.field.nodeName) ? opts.field : null;

            opts.theme = (typeof opts.theme) === 'string' && opts.theme ? opts.theme : null;

            opts.bound = !!(opts.bound !== undefined ? opts.field && opts.bound : opts.field);

            opts.trigger = (opts.trigger && opts.trigger.nodeName) ? opts.trigger : opts.field;

            opts.disableWeekends = !!opts.disableWeekends;

            opts.disableDayFn = (typeof opts.disableDayFn) === 'function' ? opts.disableDayFn : null;

            var nom = parseInt(opts.numberOfMonths, 10) || 1;
            opts.numberOfMonths = nom > 4 ? 4 : nom;

            if (!isDate(opts.minDate)) {
                opts.minDate = false;
            }
            if (!isDate(opts.maxDate)) {
                opts.maxDate = false;
            }
            if ((opts.minDate && opts.maxDate) && opts.maxDate < opts.minDate) {
                opts.maxDate = opts.minDate = false;
            }
            if (opts.minDate) {
                this.setMinDate(opts.minDate);
            }
            if (opts.maxDate) {
                this.setMaxDate(opts.maxDate);
            }

            if (isArray(opts.yearRange)) {
                var fallback = new Date().getFullYear() - 10;
                opts.yearRange[0] = parseInt(opts.yearRange[0], 10) || fallback;
                opts.yearRange[1] = parseInt(opts.yearRange[1], 10) || fallback;
            } else {
                opts.yearRange = Math.abs(parseInt(opts.yearRange, 10)) || defaults.yearRange;
                if (opts.yearRange > 100) {
                    opts.yearRange = 100;
                }
            }

            return opts;
        },

        /**
         * return a formatted string of the current selection (using Moment.js if available)
         */
        toString: function(format)
        {
            format = format || this._o.format;
            if (!isDate(this._d)) {
                return '';
            }
            if (this._o.toString) {
              return this._o.toString(this._d, format);
            }
            if (hasMoment) {
              return moment(this._d).format(format);
            }
            return this._d.toDateString();
        },

        /**
         * return a Moment.js object of the current selection (if available)
         */
        getMoment: function()
        {
            return hasMoment ? moment(this._d) : null;
        },

        /**
         * set the current selection from a Moment.js object (if available)
         */
        setMoment: function(date, preventOnSelect)
        {
            if (hasMoment && moment.isMoment(date)) {
                this.setDate(date.toDate(), preventOnSelect);
            }
        },

        /**
         * return a Date object of the current selection
         */
        getDate: function()
        {
            return isDate(this._d) ? new Date(this._d.getTime()) : null;
        },

        /**
         * set the current selection
         */
        setDate: function(date, preventOnSelect)
        {
            if (!date) {
                this._d = null;

                if (this._o.field) {
                    this._o.field.value = '';
                    fireEvent(this._o.field, 'change', { firedBy: this });
                }

                return this.draw();
            }
            if (typeof date === 'string') {
                date = new Date(Date.parse(date));
            }
            if (!isDate(date)) {
                return;
            }

            var min = this._o.minDate,
                max = this._o.maxDate;

            if (isDate(min) && date < min) {
                date = min;
            } else if (isDate(max) && date > max) {
                date = max;
            }

            this._d = new Date(date.getTime());
            setToStartOfDay(this._d);
            this.gotoDate(this._d);

            if (this._o.field) {
                this._o.field.value = this.toString();
                fireEvent(this._o.field, 'change', { firedBy: this });
            }
            if (!preventOnSelect && typeof this._o.onSelect === 'function') {
                this._o.onSelect.call(this, this.getDate());
            }
        },

        /**
         * change view to a specific date
         */
        gotoDate: function(date)
        {
            var newCalendar = true;

            if (!isDate(date)) {
                return;
            }

            if (this.calendars) {
                var firstVisibleDate = new Date(this.calendars[0].year, this.calendars[0].month, 1),
                    lastVisibleDate = new Date(this.calendars[this.calendars.length-1].year, this.calendars[this.calendars.length-1].month, 1),
                    visibleDate = date.getTime();
                // get the end of the month
                lastVisibleDate.setMonth(lastVisibleDate.getMonth()+1);
                lastVisibleDate.setDate(lastVisibleDate.getDate()-1);
                newCalendar = (visibleDate < firstVisibleDate.getTime() || lastVisibleDate.getTime() < visibleDate);
            }

            if (newCalendar) {
                this.calendars = [{
                    month: date.getMonth(),
                    year: date.getFullYear()
                }];
                if (this._o.mainCalendar === 'right') {
                    this.calendars[0].month += 1 - this._o.numberOfMonths;
                }
            }

            this.adjustCalendars();
        },

        adjustDate: function(sign, days) {

            var day = this.getDate() || new Date();
            var difference = parseInt(days)*24*60*60*1000;

            var newDay;

            if (sign === 'add') {
                newDay = new Date(day.valueOf() + difference);
            } else if (sign === 'subtract') {
                newDay = new Date(day.valueOf() - difference);
            }

            this.setDate(newDay);
        },

        adjustCalendars: function() {
            this.calendars[0] = adjustCalendar(this.calendars[0]);
            for (var c = 1; c < this._o.numberOfMonths; c++) {
                this.calendars[c] = adjustCalendar({
                    month: this.calendars[0].month + c,
                    year: this.calendars[0].year
                });
            }
            this.draw();
        },

        gotoToday: function()
        {
            this.gotoDate(new Date());
        },

        /**
         * change view to a specific month (zero-index, e.g. 0: January)
         */
        gotoMonth: function(month)
        {
            if (!isNaN(month)) {
                this.calendars[0].month = parseInt(month, 10);
                this.adjustCalendars();
            }
        },

        nextMonth: function()
        {
            this.calendars[0].month++;
            this.adjustCalendars();
        },

        prevMonth: function()
        {
            this.calendars[0].month--;
            this.adjustCalendars();
        },

        /**
         * change view to a specific full year (e.g. "2012")
         */
        gotoYear: function(year)
        {
            if (!isNaN(year)) {
                this.calendars[0].year = parseInt(year, 10);
                this.adjustCalendars();
            }
        },

        /**
         * change the minDate
         */
        setMinDate: function(value)
        {
            if(value instanceof Date) {
                setToStartOfDay(value);
                this._o.minDate = value;
                this._o.minYear  = value.getFullYear();
                this._o.minMonth = value.getMonth();
            } else {
                this._o.minDate = defaults.minDate;
                this._o.minYear  = defaults.minYear;
                this._o.minMonth = defaults.minMonth;
                this._o.startRange = defaults.startRange;
            }

            this.draw();
        },

        /**
         * change the maxDate
         */
        setMaxDate: function(value)
        {
            if(value instanceof Date) {
                setToStartOfDay(value);
                this._o.maxDate = value;
                this._o.maxYear = value.getFullYear();
                this._o.maxMonth = value.getMonth();
            } else {
                this._o.maxDate = defaults.maxDate;
                this._o.maxYear = defaults.maxYear;
                this._o.maxMonth = defaults.maxMonth;
                this._o.endRange = defaults.endRange;
            }

            this.draw();
        },

        setStartRange: function(value)
        {
            this._o.startRange = value;
        },

        setEndRange: function(value)
        {
            this._o.endRange = value;
        },

        /**
         * refresh the HTML
         */
        draw: function(force)
        {
            if (!this._v && !force) {
                return;
            }
            var opts = this._o,
                minYear = opts.minYear,
                maxYear = opts.maxYear,
                minMonth = opts.minMonth,
                maxMonth = opts.maxMonth,
                html = '',
                randId;

            if (this._y <= minYear) {
                this._y = minYear;
                if (!isNaN(minMonth) && this._m < minMonth) {
                    this._m = minMonth;
                }
            }
            if (this._y >= maxYear) {
                this._y = maxYear;
                if (!isNaN(maxMonth) && this._m > maxMonth) {
                    this._m = maxMonth;
                }
            }

            randId = 'pika-title-' + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 2);

            for (var c = 0; c < opts.numberOfMonths; c++) {
                html += '<div class="pika-lendar">' + renderTitle(this, c, this.calendars[c].year, this.calendars[c].month, this.calendars[0].year, randId) + this.render(this.calendars[c].year, this.calendars[c].month, randId) + '</div>';
            }

            this.el.innerHTML = html;

            if (opts.bound) {
                if(opts.field.type !== 'hidden') {
                    sto(function() {
                        opts.trigger.focus();
                    }, 1);
                }
            }

            if (typeof this._o.onDraw === 'function') {
                this._o.onDraw(this);
            }

            if (opts.bound) {
                // let the screen reader user know to use arrow keys
                opts.field.setAttribute('aria-label', 'Use the arrow keys to pick a date');
            }
        },

        adjustPosition: function()
        {
            var field, pEl, width, height, viewportWidth, viewportHeight, scrollTop, left, top, clientRect;

            if (this._o.container) return;

            this.el.style.position = 'absolute';

            field = this._o.trigger;
            pEl = field;
            width = this.el.offsetWidth;
            height = this.el.offsetHeight;
            viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            scrollTop = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop;

            if (typeof field.getBoundingClientRect === 'function') {
                clientRect = field.getBoundingClientRect();
                left = clientRect.left + window.pageXOffset;
                top = clientRect.bottom + window.pageYOffset;
            } else {
                left = pEl.offsetLeft;
                top  = pEl.offsetTop + pEl.offsetHeight;
                while((pEl = pEl.offsetParent)) {
                    left += pEl.offsetLeft;
                    top  += pEl.offsetTop;
                }
            }

            // default position is bottom & left
            if ((this._o.reposition && left + width > viewportWidth) ||
                (
                    this._o.position.indexOf('right') > -1 &&
                    left - width + field.offsetWidth > 0
                )
            ) {
                left = left - width + field.offsetWidth;
            }
            if ((this._o.reposition && top + height > viewportHeight + scrollTop) ||
                (
                    this._o.position.indexOf('top') > -1 &&
                    top - height - field.offsetHeight > 0
                )
            ) {
                top = top - height - field.offsetHeight;
            }

            this.el.style.left = left + 'px';
            this.el.style.top = top + 'px';
        },

        /**
         * render HTML for a particular month
         */
        render: function(year, month, randId)
        {
            var opts   = this._o,
                now    = new Date(),
                days   = getDaysInMonth(year, month),
                before = new Date(year, month, 1).getDay(),
                data   = [],
                row    = [];
            setToStartOfDay(now);
            if (opts.firstDay > 0) {
                before -= opts.firstDay;
                if (before < 0) {
                    before += 7;
                }
            }
            var previousMonth = month === 0 ? 11 : month - 1,
                nextMonth = month === 11 ? 0 : month + 1,
                yearOfPreviousMonth = month === 0 ? year - 1 : year,
                yearOfNextMonth = month === 11 ? year + 1 : year,
                daysInPreviousMonth = getDaysInMonth(yearOfPreviousMonth, previousMonth);
            var cells = days + before,
                after = cells;
            while(after > 7) {
                after -= 7;
            }
            cells += 7 - after;
            var isWeekSelected = false;
            for (var i = 0, r = 0; i < cells; i++)
            {
                var day = new Date(year, month, 1 + (i - before)),
                    isSelected = isDate(this._d) ? compareDates(day, this._d) : false,
                    isToday = compareDates(day, now),
                    hasEvent = opts.events.indexOf(day.toDateString()) !== -1 ? true : false,
                    isEmpty = i < before || i >= (days + before),
                    dayNumber = 1 + (i - before),
                    monthNumber = month,
                    yearNumber = year,
                    isStartRange = opts.startRange && compareDates(opts.startRange, day),
                    isEndRange = opts.endRange && compareDates(opts.endRange, day),
                    isInRange = opts.startRange && opts.endRange && opts.startRange < day && day < opts.endRange,
                    isDisabled = (opts.minDate && day < opts.minDate) ||
                                 (opts.maxDate && day > opts.maxDate) ||
                                 (opts.disableWeekends && isWeekend(day)) ||
                                 (opts.disableDayFn && opts.disableDayFn(day));

                if (isEmpty) {
                    if (i < before) {
                        dayNumber = daysInPreviousMonth + dayNumber;
                        monthNumber = previousMonth;
                        yearNumber = yearOfPreviousMonth;
                    } else {
                        dayNumber = dayNumber - days;
                        monthNumber = nextMonth;
                        yearNumber = yearOfNextMonth;
                    }
                }

                var dayConfig = {
                        day: dayNumber,
                        month: monthNumber,
                        year: yearNumber,
                        hasEvent: hasEvent,
                        isSelected: isSelected,
                        isToday: isToday,
                        isDisabled: isDisabled,
                        isEmpty: isEmpty,
                        isStartRange: isStartRange,
                        isEndRange: isEndRange,
                        isInRange: isInRange,
                        showDaysInNextAndPreviousMonths: opts.showDaysInNextAndPreviousMonths,
                        enableSelectionDaysInNextAndPreviousMonths: opts.enableSelectionDaysInNextAndPreviousMonths
                    };

                if (opts.pickWholeWeek && isSelected) {
                    isWeekSelected = true;
                }

                row.push(renderDay(dayConfig));

                if (++r === 7) {
                    if (opts.showWeekNumber) {
                        row.unshift(renderWeek(i - before, month, year));
                    }
                    data.push(renderRow(row, opts.isRTL, opts.pickWholeWeek, isWeekSelected));
                    row = [];
                    r = 0;
                    isWeekSelected = false;
                }
            }
            return renderTable(opts, data, randId);
        },

        isVisible: function()
        {
            return this._v;
        },

        show: function()
        {
            if (!this.isVisible()) {
                this._v = true;
                this.draw();
                removeClass(this.el, 'is-hidden');
                if (this._o.bound) {
                    addEvent(document, 'click', this._onClick);
                    this.adjustPosition();
                }
                if (typeof this._o.onOpen === 'function') {
                    this._o.onOpen.call(this);
                }
            }
        },

        hide: function()
        {
            var v = this._v;
            if (v !== false) {
                if (this._o.bound) {
                    removeEvent(document, 'click', this._onClick);
                }
                this.el.style.position = 'static'; // reset
                this.el.style.left = 'auto';
                this.el.style.top = 'auto';
                addClass(this.el, 'is-hidden');
                this._v = false;
                if (v !== undefined && typeof this._o.onClose === 'function') {
                    this._o.onClose.call(this);
                }
            }
        },

        /**
         * GAME OVER
         */
        destroy: function()
        {
            this.hide();
            removeEvent(this.el, 'mousedown', this._onMouseDown, true);
            removeEvent(this.el, 'touchend', this._onMouseDown, true);
            removeEvent(this.el, 'change', this._onChange);
            removeEvent(document, 'keydown', this._onKeyChange);
            if (this._o.field) {
                removeEvent(this._o.field, 'change', this._onInputChange);
                if (this._o.bound) {
                    removeEvent(this._o.trigger, 'click', this._onInputClick);
                    removeEvent(this._o.trigger, 'focus', this._onInputFocus);
                    removeEvent(this._o.trigger, 'blur', this._onInputBlur);
                }
            }
            if (this.el.parentNode) {
                this.el.parentNode.removeChild(this.el);
            }
        }

    };

    return Pikaday;

}));

/**
 * Library of general purpose utilities for Beebrain, provided as a UMD module.
 * Provides a "butil" object holding various constants and utility functions.
 * No internal state.<br/>
 *
 * Copyright 2018-2022 Uluc Saranli and Daniel Reeves
 *
 * @requires moment
 * @exports butil
 */

;((function (root, factory) { // BEGIN PREAMBLE --------------------------------

'use strict'
if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("butil: Using AMD module definition")
  define(['moment'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but
  // only CommonJS-like environments that support module.exports,
  // like Node.    
  //console.log("butil: Using CommonJS module.exports")
  module.exports = factory(require('./moment'))
} else {
  //console.log("butil: Using Browser globals")
  root.butil = factory(root.moment)
}

})(this, function (moment) { // END PREAMBLE -- BEGIN MAIN ---------------------

'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const min   = Math.min
const max   = Math.max
const abs   = Math.abs
const pow   = Math.pow
const log10 = Math.log10
const floor = Math.floor
const round = Math.round
const sign  = Math.sign

const DIY = 365.25 // this is what physicists use, eg, to define a light year
const SID = 86400  // seconds in a day (not used: DIM=DIY/12, WIM=DIY/12/7)

// -----------------------------------------------------------------------------
// ---------------------------- BEEBRAIN CONSTANTS -----------------------------

// Maximum amount of time in milliseconds that Beebrain processing should take.
// Users of bgraph and related tools should implement timeouts with this amount
// to avoid infinite waits in case something goes wrong.
const MAXTIME = 60000

// Base URL for images.
const BBURL = "http://brain.beeminder.com/"

// Beeminder colors (pro tip: paste this into Slack for swatches)
// Handy: https://material.io/design/color/#tools-for-picking-colors
//        http://tutorials.jenkov.com/svg/fill-patterns.html
const BHUE = {
  DYEL:   "#ffff44", // Dark yellow  (mma 1,1,.55; py 1,1,.4)
  LYEL:   "#ffff88", // Light yellow (mma 1,1,.68; py 1,1,.6)
  ROSE:   "#ff8080", // (originally 1,1/3,1/3 then 251,130,199)
  AKRA:   "#4C4Cff", // (originally 1,1/3,1/3 then 251,130,199)
  PURP:   "#B56bb5", // Moving average line and steppy line
  LPURP:  "#E5BbE5", // Light purple for aura (previously blue/green)
  BLUE:   "#EAEAFF", // Previously used for aura                      [NOT USED]
  GRUE:   "#b5ffDE", // Aura overlap (m .832,1,.832; py .712,1,.872)  [NOT USED]
  ORNG:   "#ff8000", // Dotted centerline of old non-YBHP YBR
  WITE:   "#ffffff", // For hollow dots
  BIGG:   "#ffe54c", // Bigger guiding line demarcating 7-day buffer
  PINK:   "#ffe5e5", // Original pinkzone/oinkzone
  PNKE:   "#ffcccc", // Darker pink for edge of pink zone             [NOT USED]
  GRAY:   "#f0f0f0", // Watermarks (mma .9625; had .96 thru Nov 2014)
  BLCK:   "#000000", // For edges of dots
  REDDOT: "#ff0000", // Red dots for beemergencies
  ORNDOT: "#ffa500", // Orange dots for 1 safe day
  BLUDOT: "#3f3fff", // Blue dots for 2 safe days
  GRNDOT: "#00aa00", // Green dots for 3+ safe days
  GRADOT: "#228B22", // Forest green Grayson dots for 7+ safe days
  ERRDOT: "#00FFFF", // Garish cyan dots to only show if something's fubar
  RAZR0:  "#ff0000", // Bright red line for razor road; faded = #FF5436
  RAZR1:  "#ffa500", // Orange line;                    faded = #FEB642
  RAZR2:  "#3f3fff", // Blue line;                      faded = #8C7AFF
  RAZR3:  "#6BC461", // Green line;                     faded = #6BC461
}

const AKH   = 7*SID       // Akrasia horizon, in seconds 
//const BDUSK = 2147317201  // circa 2038, Rails's ENDOFDAYS+1 (was 2^31-2weeks)
const BDUSK = 4102444799 // 2099-12-31 23:59:59 UTC

// Number of seconds in a year, month, etc 
const SECS = { 'y' : DIY*SID, 
               'm' : DIY*SID/12,
               'w' : 7*SID,
               'd' : SID,
               'h' : 3600        }
// Unit names
const UNAM = { 'y' : 'year',
               'm' : 'month',
               'w' : 'week',
               'd' : 'day',
               'h' : 'hour'      }

/******************************************************************************
 *                                 FUNCTIONS                                  *
 ******************************************************************************/

// Type-checking convenience functions
function nummy(x)   { return !isNaN(parseFloat(x)) && isFinite(x) }
function stringy(x) { return typeof x === "string" }
function listy(x)   { return Array.isArray(x) }


// Min/max of an array of numbers
function arrMin(arr) { return min.apply(null, arr) } // use spread operator?
function arrMax(arr) { return max.apply(null, arr) } 

// TODO: Does not properly copy, especially for array properties. FIX
// https://github.com/beeminder/road/issues/199
// Extends a destination object with properties from a source object, optionally
// overwriting existing elements.
// @param {object}  fr Source object 
// @param {object}  to Destination object
// @param {boolean} ow Whether to overwrite existing properties of destination
function extendo(to, fr, ow) {
  let prop, hasProp
  for (prop in fr) {
    hasProp = to[prop] !== undefined
    if (hasProp && typeof fr[prop] === 'object' &&
        fr[prop] !== null  && fr[prop].nodeName === undefined ) {
      if (listy(fr[prop])) { if (ow) to[prop] = fr[prop].slice(0) }
      else to[prop] = extendo({}, fr[prop], ow)
    } else if (ow || !hasProp) {
      if (listy(fr[prop])) to[prop] = fr[prop].slice(0)
      else to[prop] = fr[prop]
    }
  }
  return to
}

// Make a deep copy of object x (simpler/better version of above?)
function deepcopy(x) {
  let y, val, key
  if (typeof x !== "object" || x === null) return x // base case
  y = listy(x) ? [] : {} // initialize the copy
  for (key in x) {
    val = x[key]
    y[key] = deepcopy(val) // recur!
  }
  return y
}

// Return the index of domain element for which the function is maximal.
/* Not currently used. 
function argmax(f, dom) {
  if (dom === null) return null
  let newdom = dom.map(f)
  let maxelt = arrMax(newdom)
  return dom[newdom.findIndex(e => e === maxelt)]
} */

/** Partitions list l into sublists whose beginning indices are separated by d,
    and whose lengths are n. If the end of the list is reached and there are
    fewer than n elements, those are not returned. 

    @param {Array} l Input array
    @param {Number} n Length of each sublist
    @param {Number} d Sublist separation
*/
function partition(l, n, d) {
  let il = l.length
  let ol = []
  for (let i=0; i < il; i+=d) if (i+n <= il) ol.push(l.slice(i,i+n))
  return ol
}

// Return a list containing the fraction and integer parts of a float
function modf(x) {
  const s = sign(x)
  const fl = floor(s*x)
  return [s*(s*x-fl), s*fl]
}

// The qth quantile of values in l. For median, set q=1/2.
// See http://reference.wolfram.com/mathematica/ref/Quantile.html 
// by Ernesto P. Adorio, PhD; UP Extension Program in Pampanga, Clark Field
// @param {Number[]} l Input array
// @param {Number} q Desired quantile, in range [0,1]
// @param {Number} [qt=1] Type of quantile computation, Hyndman and Fan
//   algorithm, integer between 1 and 9
// @param {boolean} [issorted=false] Flag to indicate whether the input array is
// sorted.
function quantile(l, q, qt=1, issorted=false) {
  let y
  if (issorted) y = l
  else y = l.slice().sort((a,b)=>(a-b))
  if (qt < 1 || qt > 9) return null // error
  
  let abcd = [         // Parameters for the Hyndman and Fan algorithm
    [0,   0,   1, 0],  // R type 1: inv. emp. CDF (mathematica's default)
    [1/2, 0,   1, 0],  // R type 2: similar to type 1, averaged
    [1/2, 0,   0, 0],  // R type 3: nearest order statistic (SAS)
    [0,   0,   0, 1],  // R type 4: linear interp. (California method)
    [1/2, 0,   0, 1],  // R type 5: hydrologist method
    [0,   1,   0, 1],  // R type 6: mean-based (Weibull m; SPSS, Minitab)
    [1,  -1,   0, 1],  // R type 7: mode-based method (S, S-Plus)
    [1/3, 1/3, 0, 1],  // R type 8: median-unbiased
    [3/8, 1/4, 0, 1]], // R type 9: normal-unbiased
      a = abcd[qt-1][0],
      b = abcd[qt-1][1],
      c = abcd[qt-1][2],
      d = abcd[qt-1][3],
      n = l.length,
      out = modf(a + (n+b)*q - 1),
      g = out[0],
      j = out[1]
  if (j < 0) return y[0]
  else if (j >= n) return y[n-1] // oct.8,2010 y[n]?! off by 1 error!!
  j = floor(j)
  return (g==0)?y[j]:(y[j] + (y[j+1] - y[j])* (c + d*g))
}

/** Return a list with the sum of the elements in l 
 @param {list} l Input array */
function sum(l) { return l.reduce((a,b)=>(a+b), 0) }

/** Return a list with the cumulative sum of the elements in l,
    left to right 
    @param {Number[]} l*/
function accumulate(l) {
  let ne = l.length
  if (ne === 0) return l
  let nl = [l[0]]
  for (let i = 1; i < ne; i++) nl.push(nl[nl.length-1]+l[i])
  return nl
}

/** Takes a list like [1,2,1] and make it like [1,2,2] (monotone
    increasing) Or if dir==-1 then min with the previous value to
    make it monotone decreasing 
    @param {Number[]} l 
    @param {Number} [dir=1] Direction to monotonize: 1 or -1
*/
function monotonize(l, dir=1) {
  let lo = l.slice(), i
  if (dir === 1) {
    for (i = 1; i < lo.length; i++) lo[i] = max(lo[i-1],lo[i])
  } else {
    for (i = 1; i < lo.length; i++) lo[i] = min(lo[i-1],lo[i])
  }
  return lo
}

// zip([[1,2], [3,4]]) --> [[1,3], [2,4]].
// @param {Array[]} av Array of Arrays to zip
function zip(av) { return av[0].map((_,i) => av.map(a => a[i])) }

// Return 0 when x is very close to 0.
function chop(x, tol=1e-7) { return abs(x) < tol ? 0 : x }

// Return an integer when x is very close to an integer.
/* Not currently used
function ichop(x, tol=1e-7) {
  let fp = x % 1, ip = x - fp
  if (fp < 0) {fp += 1; ip -= 1;}
  if (fp > 0.5) fp = 1 - chop(1-fp)
  return floor(ip) + chop(fp, tol)
}
*/

// Clip x to be at least a and at most b: min(b,max(a,x)). Swaps a & b if a > b.
function clip(x, a, b) {
  if (a > b) [a, b] = [b, a]
  return x < a ? a : x > b ? b : x
}


// -----------------------------------------------------------------------------
// The following pair of functions -- searchHigh and searchLow -- take a sorted
// array and a distance function. A distance function is like an "is this the
// element we're searching for and if not, which way did it go?" function. It
// takes an element of the sorted array and returns a negative number if it's
// too small, a positive number if it's too big, and zero if it's just right.
// Like if you wanted to find the number 7 in an array of numbers you could use
// `x-7` as a distance function.                               L     H
//   Sorted array:                                [-1,  3,  4, 7, 7, 7,  9,  9]
//   Output of distance function on each element: [-8, -4, -3, 0, 0, 0, +2, +2]
// So searchLow would return the index of the first 7 and searchHigh the last 7.
// Or in case of no exact matches...                        L   H
//   Sorted array:                                [-1,  3,  4,  9,  9]
//   Output of distance function on each element: [-8, -4, -3, +2, +2]
// In that case searchLow returns the (index of the) 4 and searchHigh the 9. In
// other words, searchLow errs low, returning the biggest element LESS than the
// target if the target isn't found. And searchHigh errs high, returning the
// smallest element GREATER than the target if the target isn't found.
// In the case that every element is too low...                     L   H
//   Sorted array:                                [-2, -2, -1,  4,  6]
//   Output of distance function on each element: [-9, -9, -8, -3, -1]
// As you'd expect, searchLow returns the last index (length minus one) and 
// searchHigh returns one more than that (the actual array length).
// And if every element is too big...           L   H
//   Sorted array:                                [ 8,  8,  9, 12, 13]
//   Output of distance function on each element: [+1, +1, +2, +5, +6]
// Then it's the opposite, with searchHigh giving the first index, 0, and
// searchLow giving one less than that, -1.
// HISTORICAL NOTE:
// We'd found ourselves implementing and reimplementing ad hoc binary searches
// all over the Beebrain code. Sometimes they would inelegantly do O(n)
// scooching to find the left and right bounds in the case of multiple matches.
// So we made this nice general version.
// -----------------------------------------------------------------------------

// Take a sorted array (sa) and a distance function (df) and do a binary search,
// returning the index of an element with distance zero, erring low per above.
// Review of the cases:
// 1. There exist elements of sa for which df is 0: return index of first such
// 2. No such elements: return the price-is-right index (highest w/o going over)
// 3. Every element too small: return n-1 (the index of the last element)
// 4. Every element is too big: return -1 (one less than the first element)
// *This is like finding the infimum of the set of just-right elements.*
function searchLow(sa, df) {
  if (!sa || !sa.length) return -1 // empty/non-array => every element too big

  let li = -1         // initially left of the leftmost element of sa
  let ui = sa.length  // initially right of the rightmost element of sa
  let mi              // midpoint of the search range for binary search
  
  while (ui-li > 1) {
    mi = floor((li+ui)/2)
    if (df(sa[mi]) < 0) li = mi
    else                ui = mi
  }
  return ui === sa.length || df(sa[ui]) !== 0 ? li : ui
}

// Take a sorted array (sa) and a distance function (df) and do the same thing
// as searchLow but erring high. Cases:
// 1. There exist elements of sa for which df is 0: return index of last such
// 2. No such elements: return the least upper bound (lowest w/o going under)
// 3. Every element is too small: return n (one more than the last element)
// 4. Every element is too big: return 0 (the index of the first element)
// *This is like finding the supremum of the set of just-right elements.*
function searchHigh(sa, df) {
  if (!sa || !sa.length) return 0 // empty/non-array => every element too small

  let li = -1         // initially left of the leftmost element of sa
  let ui = sa.length  // initially right of the rightmost element of sa
  let mi              // midpoint of the search range for binary search
  
  while (ui-li > 1) {
    mi = floor((li+ui)/2)
    if (df(sa[mi]) <= 0) li = mi
    else                 ui = mi
  }
  return li === -1 || df(sa[li]) !== 0 ? ui : li
}

// Automon is pretty great but sometimes it would also be nice to have unit
// tests. I'm not sure how best to do that. We don't want crap like the
// following in production... 
/*
const unit_test_1 = searchLow([7,7,7], x => x-7)
if (unit_test_1 !== 0) {
  console.log("TEST FAILED: searchHigh/Low edge case")
  exit(1)
} 
*/

/******************************************************************************
 *                                  SHOWNUM                                   *
 ******************************************************************************/

/** Show Number: convert number to string. Use at most d significant figures
    after the decimal point. Target t significant figures total (clipped to be
    at least i and at most i+d, where i is the number of digits in the integer
    part of x).
    @param {Number} x Input number
    @param {Number} [t=10] Total number of significant figures 
    @param {Number} [d=5] Number of significant figures after the decimal 
    @param {Number} [e=0] Error direction for conservarounding */
function shn(x, t=10, d=5, e=0) {
  if (isNaN(x)) return x.toString()
  x = chop(x)
  let i = floor(abs(x)), k, fmt, ostr
  i = i===0 ? 0 : i.toString().length // # of digits left of the decimal
  if (abs(x) > pow(10,i)-0.5) i += 1
  if (i === 0 && x !== 0)                   // get
    k = floor(d - log10(abs(x)))       // desired
  else k = d                                // decimal digits

  // Round input to have the desired number of decimal digits
  let v = x * pow(10, k), vm = v % 10
  if (vm < 0) vm += 10

  // Hack to prevent incorrect rounding with the decimal digits:
  if (vm >= 4.5 && vm < 4.9999999) v = floor(v)
  let xn = round(v) / pow(10, k) + 1e-10

  // Crappy conservaround that just tacks on decimal places till conservative
  if (e < 0 && xn > x || e > 0 && xn < x) { 
    if (d >= 10) xn = x
    else return shn(x, t, d+1, e)
  }

  // If total significant digits < i, do something about it
  if (t < i && abs(pow(10, i-1) - xn) < 0.5) 
    xn = pow(10, i-1)
  t = clip(t, i, i+d)
  
  // If the magnitude <= 1e-4, prevent scientific notation
  if (abs(xn) < 1e-4 || floor(xn) === 9 ||
      floor(xn) === 99 || floor(xn) === 999) {
    ostr = parseFloat(x.toPrecision(k)).toString()
  } else {
    ostr = xn.toPrecision(t)
    if (!ostr.includes('e')) ostr = parseFloat(ostr)
  }
  return ostr
}

/** Show Number with Sign: include the sign explicitly. See {@link
    module:butil.shn shn}.
    @param {Number} x Input number
    @param {Number} [t=16] Total number of significant figures 
    @param {Number} [d=5] Number of significant figures after the decimal 
    @param {Number} [e=0] Error direction for conservarounding */
//shns = (x, t=16, d=5, e=0) => (x>=0 ? "+" : "") + shn(x, t, d, e)

/** Show Date: take timestamp and return something like 2012.10.22
    @param {Number} t Unix timestamp */
function shd(t) { return t === null ? 'null' : formatDate(t) }

// Show Date/Time: Take Unix timestamp and return something like 
// "2012.10.22 15:27:03". Not currently used.
//function shdt(t) return { t === null ? 'null' : formatDateTime(t) }

// Singular or Plural: Pluralize the given noun properly, if n is not 1.
// Provide the plural version if irregular. 
// Eg: splur(3, "boy") -> "3 boys", splur(3, "man", "men") -> "3 men" 
function splur(n, noun, nounp='') {
  if (nounp === '') nounp = noun + 's'
  return shn(n, 10, 5) + ' ' + (n === 1 ? noun : nounp)
}

// Rate as a string.
//function shr(r) {
//  //if (r === null) r = 0 // maybe?
//  return shn(r, 4,2)
//}

// Shortcuts for common ways to show numbers
/** shn(chop(x), 4, 2). See {@link module:butil.shn shn}.
    @param {Number} x Input 
    @param {Number} [e=0] Error direction for conservarounding */
//sh1 = function(x, e=0)  { return shn( x, 4,2, e) }
/** shns(chop(x), 4, 2). See {@link module:butil.shns shns}.
    @param {Number} x Input 
    @param {Number} [e=0] Error direction for conservarounding */
//sh1s = function(x, e=0) { return shns(x, 4,2, e) }


/******************************************************************************
 *                         QUANTIZE AND CONSERVAROUND                         *
 ******************************************************************************/

// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
// Normalize number: Return the canonical string representation. Is idempotent.
// If we were true nerds we'd do it like wikipedia.org/wiki/Normalized_number
// but instead we're canonicalizing via un-scientific-notation-ing. The other
// point of this is to not lose trailing zeros after the decimal point.
// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
function normberlize(x) {
  x = typeof x == 'string' ? x.trim() : x.toString()  // stringify the input
  const car = x.charAt(0), cdr = x.substr(1)          // 1st char, rest of chars
  if (car === '+') x = cdr                            // drop the leading '+'
  if (car === '-') return '-'+normberlize(cdr)        // set aside leading '-'
  x = x.replace(/^0+([^eE])/, '$1')                   // ditch leading zeros
  const rnum = /^(?:\d+\.?\d*|\.\d+)$/                // eg 2 or 3. or 6.7 or .9
  if (rnum.test(x)) return x                          // already normal! done!
  const rsci = /^(\d+\.?\d*|\.\d+)e([+-]?\d+)$/i      // scientific notation
  const marr = x.match(rsci)                          // match array
  if (!marr || marr.length !== 3) return 'NaN'        // hammer can't parse this
  let [, m, e] = marr                                 // mantissa & exponent
  let dp = m.indexOf('.')                             // decimal pt position
  if (dp===-1) dp = m.length                          // (implied decimal pt)
  dp += +e                                            // scooch scooch
  m = m.replace(/\./, '')                             // mantissa w/o decimal pt
  if (dp < 0) return '.' + '0'.repeat(-dp) + m        // eg 1e-3 -> .001
  if (dp > m.length) m += '0'.repeat(dp - m.length)   // eg 1e3 -> 1000
  else m = m.substring(0, dp) + '.' + m.substring(dp) // eg 12.34e1 -> 123.4
  return m.replace(/\.$/, '').replace(/^0+(.)/, '$1') // eg 0023. -> 23
}

// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
// Infer precision, eg, .123 -> .001 or "12.0" -> .1 or "100" -> 1.
// It seems silly to do this with regexes on strings instead of with floors and
// logs and powers and such but (a) the string the user typed is the ground
// truth and (b) using the numeric representation we wouldn't be able to tell
// the difference between, say, "3" (precision 1) and "3.00" (precision .01).
// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
function quantize(x) {
  let s = normberlize(x)               // put the input in canonical string form
  if (/^-?\d+\.?$/.test(s)) return 1   // no decimal pt (or only a trailing one)
  s = s.replace(/^-?\d*\./, '.')       // eg, -123.456 -> .456
  s = s.replace(/\d/g, '0')            // eg,             .456 -> .000
  s = s.replace(/0$/, '1')             // eg,                     .000 -> .001
  return +s                            // return the thing as an actual number
}

// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
// Round x to nearest r, avoiding floating point crap like 9999*.1=999.900000001
// at least when r is an integer or negative power of 10.
// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
function tidyround(x, r=1) {
  if (r < 0) return NaN
  if (r===0) return +x
  const y = round(x/r)
  const rpow = /^0?\.(0*)10*$/ // eg .1 or .01 or .001 -- a negative power of 10
  const marr = normberlize(r).match(rpow) // match array; marr[0] is whole match
  if (!marr) return y*r
  const p = -marr[1].length-1 // p is the power of 10
  return +normberlize(`${y}e${p}`)
}

// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
// Round x to the nearest r ... that's >= x if e is +1
//                          ... that's <= x if e is -1
// MASTER COPY CONFUSION WARNING: This function lives at conservaround.glitch.me
function conservaround(x, r=1, e=0) {
  let y = tidyround(x, r)
  if (e===0) return y
  if (e < 0 && y > x) y -= r
  if (e > 0 && y < x) y += r
  return tidyround(y, r) // already rounded but the +r can fu-loatingpoint it up
}

/******************************************************************************
 *                        STATS AND AGGDAY FUNCTIONS                          *
 ******************************************************************************/

/** Returns an array with n elements uniformly spaced between a and b 
 @param {Number} a Left boundary
 @param {Number} b Right boundary
 @param {Number} n Number of samples */
function linspace(a, b, n) {
  if (typeof n === "undefined") n = max(round(b-a)+1, 1)
  if (n < 2) return n===1 ? [a] : []
  let i,ret = Array(n)
  n--
  for (i=n; i>=0; i--) ret[i] = (i*b+(n-i)*a)/n
  return ret
}

// Convex combination: x rescaled to be in [c,d] as x ranges from a to b.
// PS: This wants to be called lerp, for linear interpolation. HT Freya Holmer
function rescale(x, a,b, c,d) {
  if (abs(a-b) < 1e-7) return x <= (a+b)/2 ? c : d // avoid division by 0
  return c + (x-a)/(b-a)*(d-c)
}

/**Delete Duplicates. The ID function maps elements to something that defines
   equivalence classes.
   @param {Array} a Input array
   @param {function} [idfun=(x=>x)] Function to map elements to an equivalence
           class */
function deldups(a, idfun=(x=>x)) {
  let seen = {}
  return a.filter(i => {
    const marker = JSON.stringify(idfun(i))
    return marker in seen ? false : (seen[marker] = true)
  })
}

/** Whether list l is sorted in increasing order.
    @param {Number[]} l Input list*/
function orderedq(l) {
  for (let i = 0; i < l.length-1; i++) if (l[i] > l[i+1]) return false
  return true
}

/** Whether all elements in a list are zero
    @param {Number[]} a Input list*/
function nonzero(a) {
  let l = a.length, i
  for (i = 0; i < l; i++) if (a[i] !== 0) return true
  return false
}

/** Sum of differences of pairs, eg, [1,2,6,9] -> 2-1 + 9-6 = 1+3 = 4
    If there's an odd number of elements then the last one is ignored.
    @param {Number[]} a Input list*/
function clocky(a) {
  let s = 0
  for (let i = 1; i < a.length; i += 2) s += a[i]-a[i-1]
  return s
}

/** Arithmetic mean of values in list a
    @param {Number[]} a Input list*/
// TODO: average = (array) => array.reduce((s,x) => s+x) / array.length
function mean(a) {
  let s = 0, l = a.length, i
  if (l == 0) return 0
  for(i = 0; i < l; i++) s += a[i]
  return s / a.length
}

/** Median of values in list a
    @param {Number[]} a Input list*/
function median(a) {
  let m = 0, l = a.length
  a.sort((a,b)=>a-b)
  if (l % 2 === 0) m = (a[l/2-1] + a[l/2]) / 2
  else m = a[(l-1) / 2]
  return m
}

/** Mode (commonest) of values in list a. Breaks ties in favor of whatever 
    appears first in the lsit. (Mathematica-brain gave the median of the list of
    commonest elements but literally no one cares about aggday=mode anyway.)
    @param {Number[]} a Input list*/
function mode(a) {
  if (!a || !a.length) return NaN
  let tally = {} // hash mapping each element of a to how many times it appears
  let maxtally = 1
  let maxitem = a[0]
  for (const i in a) {
    tally[a[i]] = (tally[a[i]] || 0) + 1
    if (tally[a[i]] > maxtally) {
      maxtally = tally[a[i]]
      maxitem = a[i]
    }
  }
  return maxitem
}

// Trimmed mean. Takes a list of numbers, a, and a fraction to trim.
function trimmean(a, trim) {
  const n = floor(a.length * trim)
  const ta = a.sort((a,b) => a-b).slice(n, a.length - n) // trimmed array
  return ta.reduce((a,b) => a+b) / ta.length
}

/** Whether min <= x <= max.
    @param {Number} x
    @param {Number} min
    @param {Number} max */
// function inrange(x, min, max) { return x >= min && x <= max }

/** Whether abs(a-b) < eps 
    @param {Number} a
    @param {Number} b
    @param {Number} eps */
function nearEq(a, b, eps) { return abs(a-b) < eps }

/******************************************************************************
 *                              DATE FACILITIES                               *
 ******************************************************************************/

/** Returns a new date object ahead by the specified number of
 * days (uses moment)
 @param {moment} m Moment object
 @param {Number} days Number of days to add */
/* Not currently used
function addDays(m, days) {
  let result = moment(m)
  result.add(days, 'days')
  return result
}
*/

/* Utility functions from hmsparsafore in case they're useful...

// Convenience function. What Jquery's isNumeric does, I guess. Javascript wat?
function isnum(x) { return x - parseFloat(x) + 1 >= 0 }

// Take a Date object, set the time back to midnight, return new Date object
function dayfloor(d) {
  let x = new Date(d)
  x.setHours(0)
  x.setMinutes(0)
  x.setSeconds(0)
  return x
}

// Given a time of day expressed as seconds after midnight (default midnight),
// return a Date object corresponding to the soonest future timestamp that
// matches that time of day
function dateat(t=0) {
  if (isNaN(t)) { return null }
  let now = new Date()
  let d = new Date()
  d.setTime(dayfloor(d).getTime() + 1000*t)
  if (d < now) { d.setTime(d.getTime() + 1000*86400) }
  return d  
}

// Turn a Date object (default now) to unixtime in seconds
function unixtm(d=null) {
  if (d===null) { d = new Date() }
  return d.getTime()/1000
}

// Turn a unixtime in seconds to a Date object
function dob(t=null) {
  if (t===null) { return new Date() }
  return isnum(t) ? new Date(1000*t) : null
}

// [Tested, works, at least for current and future timestamps]
// Takes unixtime and returns time of day represented as seconds after midnight.
function TODfromUnixtime(t) {
  let offset = new Date().getTimezoneOffset()
  return (t - offset*60) % 86400
}
*/

/** Fixes the supplied unixtime to 00:00:00 on the same day (uses Moment)
    @param {Number} ut Unix time  */
function daysnap(ut) {
  let d = moment.unix(ut).utc()
  d.hours(0)
  d.minutes(0)
  d.seconds(0)
  d.milliseconds(0)
  return d.unix()
}

/** Scooches unixtime ut to 00:00:00 on the first of the month (uses Moment)
    @param {Number} ut Unix time  */
function monthsnap(ut) {
  let d = moment.unix(ut).utc()
  d.date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  return d.unix()
}

/** Fixes the supplied unixtime to the first day 00:00:00 on the
    same year (uses moment)
    @param {Number} ut Unix time  */
function yearsnap(ut) {
  let d = moment.unix(ut).utc()
  d.month(0).date(1).hours(0).minutes(0).seconds(0).milliseconds(0)
  return d.unix()
}

/** Formats the supplied unix time as YYYY.MM.DD
    @param {Number} ut Unix time  */
function formatDate(ut) {
  let mm = moment.unix(ut).utc()
  let year = mm.year()
  let month = (mm.month()+1)
  month = month < 10 ? "0"+month.toString() : month.toString()
  let day = mm.date()
  day= day < 10 ? "0"+day.toString() : day.toString()
  return year+"."+month+"."+day
}

/** Formats the supplied unix time as YYYY.MM.DD HH.MM.SS
    @param {Number} ut Unix time  */
function formatDateTime(ut) {
  let mm = moment.unix(ut).utc()
  let hour = mm.hour()
  hour = hour < 10 ? "0"+hour.toString() : hour.toString()
  let minute = mm.minute()
  minute = minute < 10 ? "0"+minute.toString() : minute.toString()
  let second = mm.second()
  second = second < 10  ? "0"+second.toString() : second.toString()
  return formatDate(ut)+" "+hour+":"+minute+":"+second
}

let dpre_empty = RegExp('^(\\d{4})(\\d{2})(\\d{2})$')
let pat_empty = "YYYYMMDD"
/** Take a daystamp like "20170531" and return unixtime in seconds
    (dreev confirmed this seems to match Beebrain's function)
    @param {String} s Daystamp as a string "YYYY[s]MM[s]DD"
    @param {String} [sep=''] Separator character */
function dayparse(s, sep='') {
  let re, pat
  if (s == null) return null
  if (sep=='') {
    // Optimize for the common case
    re = dpre_empty
    pat = pat_empty
  } else {
    // General case with configurable separator
    re = RegExp('^(\\d{4})'+sep+'(\\d{2})'+sep+'(\\d{2})$')
    pat = "YYYY"+sep+"MM"+sep+"DD"
  }
  let match
  if (typeof(s) != 'string') match = null
  else match = s.match(re) 
  if (!match) { // make sure the supplied date is a timestamp
    if (!isNaN(s)) return Number(s)
    else return NaN
  }
  return Date.UTC(match[1], match[2]-1, match[3])/1000
}

/** Take an integer unixtime in seconds and return a daystamp like
    "20170531" (dreev superficially confirmed this works) Uluc: Added
    option to choose a separator
    @param {Number} t Integer unix timestamp
    @param {String} [sep=''] Separator character to use */
function dayify(t, sep = '') {
  if (isNaN(t) || t < 0) { return "ERROR" }
  if (t == null) return null
  let mm = moment.unix(t).utc()
  let y = mm.year()
  let m = mm.month() + 1
  let d = mm.date()
  return '' + y + sep + (m < 10 ? '0' : '') + m + sep + (d < 10 ? '0' : '') + d
}
  
/** adjasof: Indicates whether the date object for "now" should be
 * adjusted for the asof value to support the sandbox etc. */
function nowstamp(tz, deadline, asof) {
  let d
  if (tz) {
    // Use supplied timezone if moment-timezone is loaded
    if (moment.hasOwnProperty('tz'))  d = moment().tz(tz)
    else {
      console.log("butil.nowstamp: moment-timezone is not loaded, using local time")
      d = moment() // Use local time if moment-timezone is not loaded
    }
  } else {
    console.log("butil.nowstamp: no timezone specified, using local time")
    d = moment()
  }
  // Set date of the time object to that of asof to support the
  // sandbox and example goals with past asof
  if (asof) {
    const tasof = moment.unix(asof).utc()
    const tdiff = (moment(d).utc() - tasof)/1000
    // Hack to ensure "Yesterday" appears in the dueby table when the
    // current time is past the deadline on the next day
    if (tdiff < 0 || tdiff > 2*SID)
      d.year(tasof.year()).month(tasof.month()).date(tasof.date())
  }
  d.subtract(deadline, 's')
  return d.format("YYYYMMDD")
}

// Convert a number to an integer string.
function sint(x) { return round(x).toString() }

/** Returns a promise that loads a JSON file from the supplied
    URL. Resolves to null on error, parsed JSON object on
    success. 
    @param {String} url URL to load JSON from*/
function loadJSON(url) {
  return new Promise(function(resolve, reject) {
    if (url === "") resolve(null)
    let xobj = new XMLHttpRequest()
    xobj.overrideMimeType("application/json")
    xobj.onreadystatechange = function () {
      if (xobj.readyState == 4 &&
          (xobj.status == "200" ||
              (xobj.status == "0" && xobj.responseText != ""))) {
        try {
          resolve(JSON.parse(xobj.responseText))
        } catch(err) {
          // Possible parse error in loading the bb file
          console.log("butil.loadJSON: Could not parse JSON file in "+url)
          console.log(err.message)
          resolve(null)
        }
      } else if (xobj.readyState == 4) {
        resolve(null)
      }
    }
    xobj.open('GET', url, true)
    xobj.send(null)
  })
}

/** Changes first letter of each word to uppercase 
    @param {String} str Input string*/
function toTitleCase(str) {
  return str.replace( /\w\S*/g, function(txt) { 
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()});
}

/** Deep compares array a1 and a2 for equality. Does not work on
 * objects within the array 
 @param {Array} a1 First array 
 @param {Array} a2 Second array */
function arrayEquals(a1, a2) {
  // if the other array is a falsy value, return
  if (!(a1 instanceof Array) || !(a2 instanceof Array)) return false

  // compare lengths - can save a lot of time 
  if (a1.length != a2.length) return false

  for (let i = 0, l = a1.length; i < l; i++) {
    // Check if we have nested arrays
    if (a1[i] instanceof Array && a2[i] instanceof Array) {
      // recurse into the nested arrays
      if (!arrayEquals(a1[i], a2[i])) return false
    } else if (a1[i] !== a2[i]) { 
      // Warning - two separate object instances will never
      // be equal: {x:20} != {x:20}
      return false
    }           
  }       
  return true
}

/******************************************************************************
 *                            LINE PROCESSING                                 *
 ******************************************************************************/
/** Returns the value of the line starting from "s", ending at "e" at
 * the provided "x" coordinate */
function lineval(s, e, x) {
  var sl = (e[1]-s[1])/(e[0]-s[0])
  return s[1] + sl * (x-s[0])
}

/** Returns the intersection of the lines starting and ending at s1,e1
 * and s2,s2, respectively, returning null if no intersection is
 * found. */
function lineintersect(s1, e1, s2, e2) { 
  // Solve the equation 
  //   [(e1-s1) -(e2-s2)]*[a1 a2]^T = s2-s1
  // for [a1 a2]. Both a1 and a2 should be in the range [0,1] for segments to
  // intersect. The matrix on the lhs will be singular if the lines are
  // collinear.
  const a =   e1[0] - s1[0],  c =   e1[1] - s1[1]
  const b = -(e2[0] - s2[0]), d = -(e2[1] - s2[1])
  const e =   s2[0] - s1[0],  f =   s2[1] - s1[1]
  const det = a*d - b*c
  if (det == 0) return null
  const a1 = ( d*e - b*f)/det
  const a2 = (-c*e + a*f)/det
  if (a1 < 0 || a1 > 1 || a2 < 0 || a2 > 1) return null
  return [s1[0]+a1*a, s1[1]+a1*c]
}


/******************************************************************************
 *                                 SPLINE FIT                                 *
 ******************************************************************************/

// TODO

// All the constants and functions butil exports
return {
  MAXTIME, BBURL, BHUE, AKH, BDUSK, SECS, UNAM, 
  nummy, stringy, listy,
  arrMin, arrMax, extendo, deepcopy, partition, quantile, sum,
  accumulate, monotonize, zip, chop, clip, 
  searchLow, searchHigh, 
  shn, shd, splur, 
  conservaround, 
  linspace, rescale, deldups, orderedq, nonzero, 
  clocky, mean, median, mode, trimmean, 
  nearEq, 
  daysnap, monthsnap, yearsnap, formatDate, dayparse, dayify, nowstamp, 
  loadJSON, toTitleCase, arrayEquals,
  lineintersect, lineval
}

})); // END MAIN ---------------------------------------------------------------

/**
 * Library of utilities for Beebrain, provided as a UMD module. Returns a
 * "broad" (Beeminder Road) object with public member functions and constants
 * for calculating things about the piecewise linear function representing
 * Beeminder's Bright Red Line (nee Yellow Brick Road). Does not hold any
 * internal state.
 *
 * Copyright 2018-2022 Uluc Saranli and Daniel Reeves

 @requires moment
 @requires butil

 @exports broad
*/

;((function(root, factory) { // BEGIN PREAMBLE ---------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("broad: Using AMD module definition")
  define(['moment', 'Polyfit', 'butil'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.
  //console.log("broad: Using CommonJS module.exports")
  module.exports = factory(require('./moment'), 
                           require('./polyfit'), 
                           require('./butil'))
} else {
  //console.log("broad: Using Browser globals")
  root.broad = factory(root.moment, root.Polyfit, root.butil)
}

})(this, function(moment, Polyfit, bu) { // END PREAMBLE -- BEGIN MAIN ---------

'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

//const rnd   = Math.round
const max   = Math.max
const min   = Math.min
const abs   = Math.abs
const pow   = Math.pow
const floor = Math.floor
const ceil  = Math.ceil
const sign  = Math.sign

const DIY = 365.25
const SID = 86400

// -----------------------------------------------------------------------------
// ------------------- PUBLIC MEMBER CONSTANTS AND FUNCTIONS -------------------

var self = {}

self.rsk8 = 0 // Hack for skatesum (should be current daily rate but isn't)

/** Collection of functiont to perform datapoint aggregation
    @enum {function} */
self.AGGR = {
last     : (x) => x[x.length-1],
first    : (x) => x[0],
min      : (x) => bu.arrMin(x),
max      : (x) => bu.arrMax(x),
truemean : (x) => bu.mean(x),   // deprecated alias for mean/average
uniqmean : (x) => bu.mean(bu.deldups(x)), // deprecate? no one wants this
average  : (x) => bu.mean(x),
mean     : (x) => bu.mean(bu.deldups(x)), // to be changed later to normal mean
median   : (x) => bu.median(x),
mode     : (x) => bu.mode(x),
trimmean : (x) => bu.trimmean(x, 0.1), // no one actually wants this
sum      : (x) => bu.sum(x),
jolly    : (x) => x.length > 0 ? 1 : 0, // deprecated alias for binary
binary   : (x) => x.length > 0 ? 1 : 0,
nonzero  : bu.nonzero,
triangle : (x) => bu.sum(x)*(bu.sum(x)+1)/2, // HT DRMcIver
square   : (x) => pow(bu.sum(x),2),
clocky   : bu.clocky, // sum of differences of pairs
count    : (x) => x.length, // number of datapoints
kyshoc   : (x) => min(2600, bu.sum(x)), // ad hoc, guineapigging; deprecated
skatesum : (x) => min(self.rsk8, bu.sum(x)), // cap at daily rate
cap1     : (x) => min(1, bu.sum(x)), // sum but capped at 1
}

/*
For aggdays that pick one datapoint value (first, last, min, max), allvals 
should be the raw values (plus the previous day's aggval if kyoomy). 
For aggday=sum, you want to see the incremental sums. 
For exotic aggdays... it's super non-obvious what's best...

One tiny improvement we could make to the current code though: 
for aggday=sum, we want allvals to use the incremental sums regardless of 
whether the goal is kyoomy.
*/


/** Enum object to identify field types for road segments. 
    @enum {number} */
self.RP = { DATE:0, VALUE:1, SLOPE:2 }

/** Pretty prints a given array of road segments.
    @param {Array} rd Array of road segment objects */
self.printRoad = (rd) => {
  for (let i = 0; i < rd.length; i++) {
    var s = rd[i]
    console.debug("[("+s.sta[0]+"("+bu.formatDate(s.sta[0])+"),"+s.sta[1]+
                  "),("+s.end[0]+"("+bu.formatDate(s.end[0])+"),"+s.end[1]+"),"+
                  s.slope+", auto="+s.auto+"]")
  }
}

/** Checks whether two road arrays are identical with nearEq segments.
    @param rda First array fo road segments
    @param rdb Second array fo road segments */
self.sameRoads = ( rda, rdb ) => {
  if (rda.length != rdb.length) return false
  for (let i = 0; i < rda.length; i++) {
    if (!bu.nearEq(rda[i].end[0], rdb[i].end[0], 10))   return false
    if (!bu.nearEq(rda[i].end[1], rdb[i].end[1], 10))   return false
    if (!bu.nearEq(rda[i].slope,  rdb[i].slope, 1e-14)) return false
  }
  return true
}

/** Creates and returns a clone of the supplied road array */
self.copyRoad = (rd) => {
  var nr = []
  for (let i = 0; i < rd.length; i++) {
    var s = {
      sta:   rd[i].sta.slice(), 
      end:   rd[i].end.slice(),
      slope: rd[i].slope, 
      auto:  rd[i].auto,
    }
    nr.push(s)
  }
  return nr
}

// These are not currently used but they might be handy elsewhere?
//const st = i => rd[i].sta[0]                 // start time of ith road segment
//const et = i => rd[i].end[0]                  // end time of ith road segment
//const isin = (t,i) => st(i) <= t && t < et(i)  // whether segment i contains t
//const delt = s => t < s.sta[0] ? s.sta[0]-t :   // Road segment s's delta
//                  t > s.end[0] ? s.end[0]-t : 0 // from t (0 if t is w/in s).

// Find the index of the road segment containing the given t-value. This may not
// be unique since there can a vertical segment (or multiple ones) exactly at
// the given t-value. In that case go with the segment after the vertical
// segments. Which makes sense since the segment after the vertical ones also
// contains t: that segment will necessarily start exactly at t.
// Since we've added a flat dummy segment after tfin (and before tini), we're
// guaranteed to find a non-vertical segment for any t-value.
self.findSeg = (rd, t) => {
  return bu.searchHigh(rd, s => s.end[0] < t ? -1 :
                                s.sta[0] > t ? +1 : 0)
}


/* SCRATCH AREA -- last remnants of search refactoring #SCHDEL

// Find the index of the road segment containing the given t-value. Note that
// there could be a vertical segment (or even multiple ones) exactly at the
// given t-value. In that case the dir parameter says how to disambiguate. Since
// we've added a flat dummy segment after tfin (and before tini), we're
// guaranteed to find a non-vertical segment for any t-value.
// Cases:
// 1. t is within exactly one segemnt: easy, return (the index of) that segment
// 2. t is on a boundary between 2 segments: return 2nd one (regardless of dir)
// 3. t is on a vertical segment & dir=-1: return the first vertical segment
// 4. t on a vert segmt & dir=+1: return the non-vertical segment to the right
// 5. t on a vert segmt & dir=0: return the vertical segment (if there are
//    multiple vertical segments all at t, return one arbitrarily)
self.findSeg_old = (rd, t, dir=0) => {
  const st = i => rd[i].sta[0]                 // start time of ith road segment
  const et = i => rd[i].end[0]                  // end time of ith road segment
  const isin = (t,i) => st(i) <= t && t < et(i)  // whether segment i contains t

  if (!rd || !rd.length || t < st(0) || t > et(rd.length-1)) return -1

  let a = 0            // initially the index of the leftmost road segment
  let b = rd.length-1  // initially the index of the rightmost road segment
  let m                // midpoint of the search range for binary search
  while (b-a > 1) {
    m = floor((a+b)/2)
    if (st(m) <= t) a = m // m is good or too far left (so throw away left half)
    else            b = m // m is too far right (so throw away right half)
  }   // at this point a & b are consecutive and at least one of them contains t
  m = isin(t, b) ? b : a // if both a & b contain t, pick b (bias right)
  // TODO: find a test bb file where doing this scooching actually matters:
  if (dir < 0) while(m > 0           && st(m-1) === t) m--
  if (dir > 0) while(m < rd.length-1 && st(m+1) === t) m++
  return m
}

  // the version that matches the original findSeg on paper:
  //return dir > 0 ? bu.searchHigh(rd, delt) : bu.searchLow(rd, s=>s.sta[0]-t)

  // i think this is unneeded and searchHigh/Low cover this:
  if (!rd || !rd.length || t < st(0) || t > et(rd.length-1)) return -1

  let li = -1         // initially left of the leftmost element of sa
  let ui = rd.length  // initially right of the rightmost element of sa
  let mi              // midpoint of the search range for binary search
  
  while (ui-li > 1) {
    mi = floor((li+ui)/2)
    if (delt(rd[mi]) <= 0) li = mi // df(rd[mi])<0 searchLow; st(mi)<=t old
    else                   ui = mi
  }
  mi = isin(t, ui) ? ui : li // bias right
  if (dir < 0) while(mi > 0           && st(mi-1) === t) mi--
  if (dir > 0) while(mi < rd.length-1 && st(mi+1) === t) mi++
  return mi

  //return bu.searchLow(rd, s => {s.end[0] <  t ? -1 : s.sta[0] >= t ?  1 : 0})

  for (let i = 0; i < rd.length; i++) if (isin(t, i)) return i  
  console.log(`DEBUG WTF NO ROAD SEGMENT CONTAINS ${t}`)
  return null
  
  //return bu.clip(bu.searchLow(rd, s=>s.sta[0] < t ? -1:1), 0, rd.length-1)

  return bu.clip((dir > 0 ? bu.searchHigh(rd, delt)
                          : bu.searchLow(rd, s=>s.sta[0]-t)), 1, rd.length - 2)
*/

/** Computes the slope of the supplied road segment */
self.segSlope = (rd) => (rd.end[1] - rd.sta[1]) / (rd.end[0] - rd.sta[0])

/** Computes the value of a road segment at the given timestamp */
self.segValue = (rdseg, x) => rdseg.sta[1] + rdseg.slope*(x - rdseg.sta[0])

/** Computes the value of a road array at the given timestamp */
self.rdf = (rd, x) => self.segValue( rd[self.findSeg(rd, x)], x )

/**Recompute road matrix starting from the first node and assuming that exactly
   one of the slope, enddate, or endvalue parameters is chosen to be
   automatically computed. If usematrix is true, autocompute parameter
   selections from the road matrix are used. */
self.fixRoadArray = (rd, autop=self.RP.VALUE, usematrix=false, 
                     edited=self.RP.VALUE) => {
  const nr = rd.length
  // Fix the special first road segment w/ slope always 0
  rd[0].sta[0] = rd[0].end[0] - 100*DIY*SID
  rd[0].sta[1] = rd[0].end[1]
  
  // Iterate thru the remaining segments until the last one
  for (let i = 1; i < nr-1; i++) {
    //console.debug("before("+i+"):[("+rd[i].sta[0]+
    //","+rd[i].sta[1]+"),("+rd[i].end[0]+","
    //+rd[i].end[1]+"),"+rd[i].slope+"]")
    if (usematrix) autop = rd[i].auto
    
    var dv = rd[i].end[1] - rd[i].sta[1] 
    
    rd[i].sta[0] = rd[i-1].end[0]
    rd[i].sta[1] = rd[i-1].end[1]
    
    if (autop === self.RP.DATE) {
      if (isFinite(rd[i].slope) && rd[i].slope != 0) {
        rd[i].end[0] = bu.daysnap(
          rd[i].sta[0]+(rd[i].end[1]-rd[i].sta[1])/rd[i].slope)
      }
      // Sanity check
      if (rd[i].end[0] <= rd[i].sta[0])
        rd[i].end[0] = bu.daysnap(rd[i].sta[0]+SID)
       
      if (edited === self.RP.SLOPE)
        // Readjust value if slope was edited
        rd[i].end[1] = rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0])
      else
        // Readjust value if value was edited
        rd[i].slope = self.segSlope(rd[i])
    } else if (autop === self.RP.VALUE) {
      if (isFinite(rd[i].slope))
        rd[i].end[1] = rd[i].sta[1]+rd[i].slope*(rd[i].end[0]-rd[i].sta[0])
      else
        // If slope is infinite, preserve previous delta
        rd[i].end[1] = rd[i].sta[1]+dv  
    } else if (autop === self.RP.SLOPE)
      rd[i].slope = self.segSlope(rd[i])
  }
     
  // Fix the last segment
  if (nr > 1) {
    rd[nr-1].sta[0] = rd[nr-2].end[0]
    rd[nr-1].sta[1] = rd[nr-2].end[1]
    rd[nr-1].end[0] = rd[nr-1].sta[0] + 100*DIY*SID
    rd[nr-1].end[1] = rd[nr-1].sta[1]
  }
}

/**Good delta: Return the delta from the given point to the razor road but with
   the sign such that being on the good side of the road gives a positive delta
   and being on the wrong side gives a negative delta. */
self.gdelt = (rd, g, t, v) => bu.chop(g.yaw*(v - self.rdf(rd, t)))

/** Whether the given point is on or on the good side of the bright red line */
self.aok = (rd, g, t, v) => {
  //console.log(`DEBUG: ${JSON.stringify(rd)}`)
  // DRY: this check is basically the same code as isoside()
  return g.yaw * (v - self.rdf(rd, t)) >= abs(v)*-1e-15
}

// Experimenting with new PPR functions per gissue#239 in which we assume a new
// parameter, D, which gives a minimum PPR, possibly specified by the user, and
// possibly a generalization of maxflux so we can use a consistent PPR function
// for all goal types (e.g., D would be 0 for do-more goals and we'd get the 
// expected PPR=0 for that case). The three possibilities for the PPR function
// are as follows, where r is the daily rate aka slope of the red line):
// 0. PPR = 2r but just absolute 2 if r=0 (old status quo, gross discontinuity!)
// 1. PPR = 2r but at least D (and special case to match status quo if D=0)
// 2. PPR = r+D but at least 0
// (See /tests/ppr_test.html for experimenting with these)
self.pprtype = 1 // choose 0, 1, or 2
self.dailymin = 0 // assumed to always be opposite sign of yaw

/** Pessimistic Presumptive Report (PPR). If this is being computed for *today*
    then return 0 when PPRs are actually turned off (g.ppr==false). If it's
    being computed for the future then go ahead and compute the PPR regardless.
    That's because we want the PPR setting to determine whether to draw today's
    anticipated ghosty PPR datapoint, but then for the future we need to always 
    assume PPRs. Otherwise do-less goals would always have infinite safety
    buffer! In short, the PPR setting only matters for *today*.
    Uluc added two parameters: 
    * i: You can pass in a specific segment of the red line, i, to override the
      rtf() call. The dtdarray function passes in a red line segment like that.
    * pastppr: This parameter disablees ppr=0 for t<asof since nonzero PPRs are
      needed to generate regions before asof. */
self.ppr = (rd, g, t, i=null, pastppr=false) => {
  // Suppress the PPR if (a) we're computing it for today and (b) there's
  // already a datapoint entered today or if PPRs are explicitly turned off:
  if (!pastppr && t <= g.asof && (!g.ppr || g.tdat === g.asof)) return 0
  // Otherwise it's (a) for the future or (b) for today and PPRs are turned on
  // and there's no datapoint added for today, so go ahead and compute it...

  // One more special case. In theory the max-or-min(D, 2*r) function makes
  // sense for do-more and weight-loss goals too but the isoline monotonicity
  // filtering can't handle it currently so we force such goals to have PPR=0:
  if (g.yaw*g.dir >= 0) return 0 // MOAR/PHAT => PPR=0; for WEEN/RASH read on...

  const r = i !== null ? rd[i].slope     * SID :  // Daily rate aka slope of the
                         self.rtf(rd, t) * SID    //   red line.
  const y = g.yaw
  let D = -y * self.dailymin // (g.maxflux || 0)

  switch (self.pprtype) {
  case 0:
    if (r===0)   return -y*2  // absolute PPR of 2 gunits if flat slope
    if (y*r > 0) return 0     // don't let it be an OPR (optimistic presumptive)
    else         return 2*r   // normally PPR at twice the daily rate
  case 1:
    if (r===0 && D===0) D = -y*2 // be backward compatible with status quo ante
    return y*min(y*D, y*2*r) // ie, min(D, 2*r) but max(D, 2*r) if yaw<0
  case 2:
    if (y < 0) return max(0, D + r) // pos (or 0) PPR for do-less/weight
    else       return min(0, D + r) // neg (or 0) PPR for rationing
  }
}

/** Return number of days to derail for the current road.
    TODO: There are some issues with computing tcur, vcur */
self.dtd = (rd, gol, t, v) => {
  if (self.redyest(rd, gol, t)) return 0 // TODO: need iso here

  let x = 0 // the number of steps
  let vpess = v + self.ppr(rd, gol, t+x*SID) // value as we walk fwd w/ PPRs
  while (self.aok(rd, gol, t+x*SID, vpess) && t+x*SID <= max(gol.tfin, t)) {
    x += 1 // walk forward until we're off the YBR
    vpess += self.ppr(rd, gol, t+x*SID)
  }
  return x
}
  
/*
Computes piecewise linear dtd (days-to-derail) functions for every inflection
point (aka kink) of the red line (aka road). This is returned as an array, 
having as many elements as kinks, of possibly differently sized arrays that 
describe the piecewise linear dependence of the dtd function on the y-coordinate
for the corresponding point on the road. For example:
[
  [                            // Entry for node n (rightmost) on the road
    [t_n y0 dtd0 y1 dtd1],
  ],          
  [                            // Entry for node n-1 on the road
    [t_(n-1) y0 dtd0 y1 dtd1], 
    [t_(n-1) y1 dtd1 y2 dtd2]
  ],
  [                            // Entry for node n-1 on the road
    [t_(n-1) y0 dtd0 y1 dtd1],
    [t_(n-1) y1 dtd1 y2 dtd2]
    [t_(n-1) y2 dtd2 y3 dtd3]
  ], ...
]

The array starts from the rightmost node, for which there is only one relevant 
dtd segment that corresponds to derailing on the next road line. The next entry
is for node n-1, for which two dtd segments will be present, corresponding to 
derailing on line n-1 or line n. Subsequent road nodes have additional rows 
corresponding to derailing on newly considered road lines.

This dtd array is computed by following the endpoints of every road line segment
backwards along the dtd vector, whose x-coordinate is always 1 days, with the 
y-coordinate dependent on the current road slope for do-less goals and 0 for 
do-more goals. This array can then be used later to compute isolines for the dtd
function, which are curves along which the dtd function is constant. This is 
used to compute and visualize colored regions on graphs as well as guidelines.
*/
self.dtdarray = ( rd, gol ) => {
  let rdl = rd.length
  let xcur = rd[rdl-1].sta[0], ycur = rd[rdl-1].sta[1], xn, yn
  let ppr = self.ppr(rd, gol, 0, rdl-1), sl, dtd
  let arr = [], seg
  arr = [[[xcur, ycur, 0, ycur-ppr, 1]]]
  for (let i = rdl-2; i >= 0; i--) {
    xcur = rd[i].sta[0]
    ycur = rd[i].sta[1]
    xn = rd[i].end[0]
    yn = rd[i].end[1]
    ppr = self.ppr(rd, gol, 0, i, true)
    dtd = ((xn-xcur)/SID)
    if (!isFinite(ppr)) {
      if (gol.dir*(ycur - yn) > 0)
        seg = [[xcur, ycur, 0, yn, dtd]]
      else
        seg = [[xcur, ycur, 0, yn, dtd]]
    } else
      seg = [[xcur, ycur, 0, yn-ppr*dtd, dtd]]
    
    var last = arr[arr.length-1]
    for (var j = 0; j < last.length; j++) {
      if (!isFinite(ppr)) {
        if (gol.dir*(ycur - yn) > 0)
          seg.push([xcur,last[j][1], last[j][2],last[j][3], last[j][4]])
        else
          seg.push([xcur,last[j][1], last[j][2]+(xn-xcur),
                         last[j][3], last[j][4]+(xn-xcur)])
      } else
        seg.push([xcur,last[j][1]-ppr*dtd, last[j][2]+dtd,
                  last[j][3]-ppr*dtd, last[j][4]+dtd])
    }
    arr.push(seg)
  }
  //console.log(arr)
  return arr
}

/**Generate and return an initial version of the isoline by processing the
   supplied dtdarray. The resulting isoline is correct for do-less and rash
   goals, but will need further processing for goal with dir*yaw>0. */
self.isoline_generate = (rd, dtdarr, gol, v) => {
  var n = dtdarr[0], nn, iso
  var s = 0, ns, j, k, st, en, sl

  function addunique(arr, pt) {
    var elt = arr[arr.length-1]
    if (elt[0] != pt[0] || elt[1] != pt[1])
      arr.push(pt)
  }
  
  // Start the isoline with a horizontal line for the end of the road
  iso = [[n[0][0]+10*SID, n[0][1]+v*(n[0][3]-n[0][1])],
         [n[0][0],        n[0][1]+v*(n[0][3]-n[0][1])]]
  for (j = 1; j < dtdarr.length; j++) {
    nn = dtdarr[j]
    // Identify dtd segment in which the desired value lies
    ns = nn.length-1
    for (k = 0; k < nn.length; k++) {
      if (v <= nn[k][4]) {
        ns = k
        break
      }
    }
    // TODO: I think this has a more elegant solution, considering additional
    // inflection points (kinks) to be just dtd prior to all inflection points
    // on the red line, rather than trying to find additional inflection lines
    // between the segment index changes?
    // This might solve the issue I am currently noticing with do-less goals?
    
    // Consider inflections between the previous segment index and newly found
    // segment index from inflection j+1 to inflection j on the road
    for (k=s; k >= ns; k--) {
      st = [n[k][0], n[k][1], n[k][2]]
      en = [nn[k][0], nn[k][3], nn[k][4]]
      if (en[2] - st[2] == 0)
        addunique(iso, [st[0], st[1]])
      else {
        sl = (v-st[2]) / (en[2]-st[2])
        addunique(iso, [st[0] + sl*(en[0]-st[0]), 
                  st[1] + sl*(en[1]-st[1])])
      }
    }
    st = [nn[ns][0], nn[ns][1], nn[ns][2]]
    en = [nn[ns][0], nn[ns][3], nn[ns][4]]
    if (en[2] - st[2] == 0)
      addunique(iso, [st[0], st[1]])
    else {
      sl = (v-st[2]) / (en[2]-st[2])
      addunique(iso, [st[0] + sl*(en[0]-st[0]), st[1]+sl*(en[1]-st[1])])
    }
    s = ns
    n = nn
  }
  return iso.reverse()  
}

/** do-less goals are normally expected not to be intersecting each
 * other. Exceptions tp this are introduced by (upwards) vertical
 * segments in such goals, which result in vertical jumps in isolines
 * and result in intersections with isolines of lower dtd. This
 * function processes a given isoline to eliminate such intersections
 * by detecting vertical segments, and when encountered, proceeds
 * along the ppr line until the same vertical segment in the redline
 * is encountered (i.e. dtd days after the vertical segment in the
 * isoline). While doing this, if the same isoline falls below the ppr
 * path, the isoline is followed instead. In other words, the provided
 * isoline is clipped with the ppr path.
*/
self.isoline_dolessclip = (iso, rd, dtdarr, gol, v) => {
  if (v == 0) return iso // nothing to do for the redline
  //console.debug("broad:isoline_dolessclip, dtd="+v)
  //const dtfunc = (a)=>[bu.shd(a[0]), a[1]]
  // Generates the ppr line associated with the provided road segment
  const pprlinef =
        (st,rdSegInd)=>{
          let seg = rd[rdSegInd], ppr = self.ppr(rd,gol,seg.sta[0],rdSegInd,true)
          //console.log("ppr="+ppr)
          return [[st[0], st[1]],[seg.end[0],st[1]+ppr*(seg.end[0]-st[0])/SID]]
        }

  // j iterates over unfiltered isoline segments
  // pprline holds the current ppr line generated from the redline
  // clipping=true starting on vertical isoline segments, extending by dtd days
  // isonppr=true means we are following the ppr line, following isoline 
  // otherwise
  let isoout = [], pprline, clipping = false, pprdone = false, rdSegInd
  let j, endday, isonppr = false
  const addpt = function(a, pt) { a.push([pt[0], pt[1]]) }

  j = 0
  while( j < iso.length-1) {
    //console.log("j = "+j)
    if (!isonppr) addpt(isoout,iso[j])
    
    if (iso[j+1][0] == iso[j][0] && (iso[j+1][1]-iso[j][1])*gol.dir>0) {
      // Encountered a vertical segment, start filtering and record
      // the expected ending time based on the dtd value for this
      // isoline.
      endday = iso[j+1][0] + v*SID
      // Find road segment coincident with the vertical segment and extract ppr
      rdSegInd = self.findSeg(rd, iso[j][0])
      // Construct ppr line until the next ppr value
      pprline = pprlinef(iso[j], rdSegInd)
      //console.log("Starting the ppr line")
      //console.log(JSON.stringify(pprline.map(dtfunc)))

      // Skip over all consecutive vertical segments
      while (j < iso.length-1 && iso[j+1][0] == iso[j][0]) j++
      // Check if multiple vertical segments ended up yielding a totla
      // downward shift, in which case we will not start clipping
      if ((iso[j][1] - pprline[0][1])*gol.dir > 0) {
        clipping = true // Start clipping
        isonppr = true  // We start on the pprline since the isoline goes up and away
      }
      continue
    }
    if (clipping) {
      if (iso[j][0] >= endday || pprline[0][0] >= endday) {
        //console.log("Finishing clipping. endday="+bu.shd(endday))
        //console.log("isoline = "+JSON.stringify([iso[j], iso[j+1]].map(dtfunc)))
        //console.log("pprline = "+JSON.stringify(pprline.map(dtfunc)))
        addpt(isoout,[endday, self.isoval(iso, endday)])
        clipping = false
        isonppr = false
        if (iso[j][0] == endday) j++ // Only proceed if isoline segment is completed
        continue
      }
      if (isonppr) {
        //console.log("Testing intersection")
        //console.log("isoline = "+JSON.stringify([iso[j], iso[j+1]].map(dtfunc)))
        //console.log("pprline = "+JSON.stringify(pprline.map(dtfunc)))
        let li = bu.lineintersect(iso[j], iso[j+1], pprline[0], pprline[1])
        if (li != null) {
          //console.log("Switching to the isoline")
          addpt(isoout, li)
          isonppr = false
          j++ // Next isoline point will be added on the while loop
        } else {
          // Check if the current ppr line ends before the current
          // isoline. If so, recompute a new ppr line, otherwise
          // continue with the next isoline segment
          if (pprline[1][0] <= iso[j+1][0]) {
            //console.log("Proceeding with the next ppr line (isonppr)")
            addpt(isoout, pprline[1])
            rdSegInd++
            // Skip over vertical segments on the road
            while (!isFinite(rd[rdSegInd].slope)) rdSegInd++
            pprline = pprlinef(pprline[1], rdSegInd)
            //console.log(JSON.stringify(pprline.map(dtfunc)))
          } else j++ // Proceed with the next isoline
        }
      } else {
        let li = bu.lineintersect(iso[j], iso[j+1], pprline[0], pprline[1])
        if (li != null && li[0] != iso[j][0] && li[0] != iso[j+1][0]) {
          console.log("Found intersection while on the isoline!!!")
          //console.log(JSON.stringify([iso[j], iso[j+1]].map(dtfunc)))
          //console.log(JSON.stringify(pprline.map(dtfunc)))
          //console.log(dtfunc(li))
        }
        if (iso[j][0] >= pprline[1][0]) {
          // isoline segment seems to be beyond the current ppr line,
          // so recompute the next ppr line
          //console.log("Proceeding with the next ppr line (!isonppr)")
          rdSegInd++
          // Skip over vertical segments on the road
          while (!isFinite(rd[rdSegInd].slope)) rdSegInd++
          pprline = pprlinef(pprline[1], rdSegInd)
          //console.log(JSON.stringify(pprline.map(dtfunc)))
        } else j++ // Proceed with the next isoline
      }
    } else j++
  }
  //console.log(JSON.stringify(isoout.map(dtfunc)))
  return isoout
}
  
/**Ensure correctness of the isoline for do-more goals such that the isoline is
   not allowed to go against 'dir' for dtd days after a road kink. This ensures
   that the first intersection with the razor road is taken as the dtd value. */
self.isoline_monotonicity = (iso, rd, dtdarr, gol, v) => {
  // do-less goals require a different kind of filtering due to how
  // vertical segments are handled
  if (gol.yaw * gol.dir < 0)
    return self.isoline_dolessclip(iso, rd, dtdarr, gol, v)
  
  let isoout = []
  let downstreak = false
  let flatdone = false
  let slope, newx, j, k
  const addpt = function(a, pt) { a.push([pt[0], pt[1]]) }

  // k holds the last isoline segment that's been processed and filtered
  k = -1
  // j iterates over unfiltered isoline segments
  for (j = 0; j < iso.length-1; j++) {
    // If an upslope is detected, finish downstreak
    if ((iso[j+1][1] - iso[j][1]) * gol.dir > 0) downstreak = false
    
    addpt(isoout, iso[j])
    
    // Check if new downstreak to initiate new flat region (when dtd != 0)
    if (v != 0 && (iso[j+1][1] - iso[j][1]) * gol.dir < 0 && !downstreak) {
      
      downstreak = true
      // Extend horizontally by at least dtd days or till we find positive slope
      k = j+1
      flatdone = false
      while (!flatdone) {
        if (iso[k][0] >= iso[j][0] + v*SID) {
          // Reached end of the flat region with dtd days
          flatdone = true
          newx = iso[j][0]+v*SID
          addpt(isoout, [newx, iso[j][1]])
          
        } else if ((iso[k+1][1] - iso[k][1]) * gol.dir >= 0) {
          // Found a positive slope, finish flat region by extending until 
          // intersection with the positive slope unless the next segment ends
          // before that.
          if (iso[k+1][0] != iso[k][0]) {
            slope = (iso[k+1][1]-iso[k][1])/
                   (iso[k+1][0]-iso[k][0])
            if (slope != 0) {
              newx = iso[k][0] + (iso[j][1] - iso[k][1])/slope
              if (newx <= iso[j][0]+v*SID && newx <= iso[k+1][0]) {
                flatdone = true
              }
            }
          } else if ((iso[j][1]-iso[k][1])*(iso[j][1]-iso[k+1][1]) < 0) {
            // Early intersection with upward vertical segment found.
            // +1 ensures that filtering gets rid of extra backward segments
            newx = iso[k][0]+1
            flatdone = true
          }
          if (flatdone) {
            addpt(isoout, [newx, iso[j][1]])
          }
        }
        k++
      }
    }
  }
  return isoout
}

/** Eliminate backward line segments introduced by the monotonicty pass. */
self.isoline_nobackward = (iso, rd, dtdarr, gol, v) => {
  var isoout = [iso[0].slice()], lastpt, slope, j
  for (j = 1; j < iso.length; j++) {
    lastpt = isoout[isoout.length-1]
    if (iso[j][0] < lastpt[0]) continue
    if (iso[j-1][0] < lastpt[0] && iso[j][0] > lastpt[0]) {
      // Intermediate point needed
      if (iso[j][0] - iso[j-1][0] != 0) {
        slope = (iso[j][1] - iso[j-1][1])/(iso[j][0] - iso[j-1][0])
        isoout.push([lastpt[0], iso[j-1][1] + slope*(lastpt[0]-iso[j-1][0])])
      }
    }
    isoout.push([iso[j][0], iso[j][1]])
  }
  return isoout
}

/* Eliminates segments on the wrong side of the road */
self.isoline_clip = ( iso, rd, dtdarr, gol, v ) => {
  var isoout = []

  // Clip a single point to the right side of the road. Assume points on
  // vertical segments are clipped wrt to the closest boundary to the wrong (side=-1)
  // or good (side=1) side of the road.
  function clippt(rd, gol, pt, side = -1) {
    var newpt = pt.slice()
    // Find the road segment [sta, end[ containing the pt
    var seg = self.findSeg(rd, pt[0])
    var rdy = self.segValue(rd[seg], pt[0])
    // If there are preceding vertical segments, take the boundary value based
    // on road yaw.
    while(--seg >= 0 && rd[seg].sta[0] == pt[0]) {
      if (-side*gol.yaw > 0) rdy = min(rdy, rd[seg].sta[1])
      else              rdy = max(rdy, rd[seg].sta[1])
    }
    if ((newpt[1] - rdy) * gol.yaw < 0) newpt[1] = rdy
    return newpt
  }

  var done = false, rdind = 0, isoind = 0, side

  // The loop below alternatingly iterates through the segments in the
  // road and the isoline, ensuring that the isoline always stays on
  // the right side of the road
  if (iso[1][0] != iso[0][0]) side = 1
  else side = -1
  isoout.push(clippt(rd, gol, iso[0], side))
  while (!done) {
    if (rdind > rd.length-1 || isoind > iso.length-2) break

    // Check whether segments are intersecting
    var ind = isoout.length-1
    var pt = bu.lineintersect(rd[rdind].sta, rd[rdind].end, iso[isoind], iso[isoind+1])
    if (pt != null && (pt[0] != isoout[ind][0] || pt[1] != isoout[ind][1])) isoout.push(pt)
    
    if (rd[rdind].end[0] < iso[isoind+1][0]) {
      // If the isoline remains below the road at road inflection
      // points, add the road inflection point to avoid leaky isolines
      // on the wrong side of the road.
      if ((bu.lineval(iso[isoind], iso[isoind+1],
                   rd[rdind].end[0]) - rd[rdind].end[1]) * gol.yaw < 0)
        isoout.push([rd[rdind].end[0], rd[rdind].end[1]])
      rdind++
    } else {
      isoind++
      // If the next isoline segment is vertical, clip to the wrong
      // side, otherwise, clip to the right side. This should resolve
      // the leaky isoline issue
      if (isoind < iso.length-1 && iso[isoind][0] != iso[isoind+1][0]) side = 1
      else side = -1
      isoout.push(clippt(rd, gol, iso[isoind], side))
    }
  }
  return isoout
}
  
/* Return an array of x,y coordinate pairs for an isoline associated with dtd=v.
 * This can be used to compute boundaries for derailment regions, as well as 
 * guidelines. Coordinate points stggart from the beginning of the road and 
 * proceed forward.
*/
self.isoline = ( rd, dtdarr, gol, v, retall=false ) => {
  let iso1 = self.isoline_generate(           rd, dtdarr, gol, v)
  let iso2 = self.isoline_monotonicity( iso1, rd, dtdarr, gol, v)
  let iso3 = self.isoline_nobackward(   iso2, rd, dtdarr, gol, v)
  let iso4 = self.isoline_clip(         iso3, rd, dtdarr, gol, v)

  if (retall) return [iso1, iso2, iso3, iso4]
  else return iso4
}
  
// Evaluate a given isoline (array of (x,y) pairs) at the supplied x-coordinate
self.isoval = (isoline, x) => {
  if (!isoline || !isoline.length) return null
  // assume isolines extend horizontally forever outside their bounds
  if (x <= isoline[               0][0]) return isoline[               0][1]
  if (x >= isoline[isoline.length-1][0]) return isoline[isoline.length-1][1]

  const i = bu.searchLow(isoline, p=>p[0]<=x?-1:1)
  //if (isoline[i][0] === isoline[i+1][0]) {
  //  console.log("Warning: isoline has vertical segment at " + x)
  //}
  return bu.rescale(x, isoline[i][0], isoline[i+1][0],
                       isoline[i][1], isoline[i+1][1])
}

// Return which side of a given isoline (an array of (x,y) pairs) a given 
// datapoint is: -1 for wrong and +1 for correct side. 
// Being exactly on an isoline counts as the good side (+1).
// Note the floating point tolerance, multiplied by abs(v) to be a bit more
// robust. In the extreme case, imagine the values are already so tiny that
// they're about equal to the tolerance. Then checking if v - isoval was greater
// than -v would be way too forgiving.
self.isoside = (g, isoline, t, v) => {
  const iv = self.isoval(isoline, t)
  if (iv === null) return 0
  return (v - iv)*g.yaw >= abs(v)*-1e-15 ? +1 : -1
}

/** Days To Derail: Count the integer days till you cross the razor road or hit
    tfin (whichever comes first) if nothing reported. Not currently used. */
self.dtd_walk = (rd, gol, t, v) => {
  let x = 0
  while(self.gdelt(rd, gol, t+x*SID, v) >= 0 && t+x*SID <= gol.tfin) x += 1
  return x
}

/** What delta from the razor road yields n days of safety buffer? 
    Not currently used. */
self.bufcap = (rd, g, n=7) => {
  const t = g.tcur
  const v = self.rdf(rd, t)
  const r = abs(self.rtf(rd, t))
  let d = 0
  let i = 0
  while(self.dtd_walk(rd, g, t, v+d) < n && i <= 70) {
    d += g.yaw*r*SID
    i += 1
  }
  return [d, i]
}

/** Given the endpt of the last road segment (tp,vp) and 2 out of 3 of
    t = goal date for a road segment (unixtime)
    v = goal value 
    r = rate in hertz (s^-1), ie, road rate per second
    return the third, namely, whichever one is passed in as null. */
self.tvr = (tp, vp, t, v, r) => {  
  if (t === null) {
    if (r === 0) return bu.BDUSK
    else         return bu.daysnap(min(bu.BDUSK, tp + (v-vp)/r))
  }
  if (v === null) return vp+r*(t-tp)
  if (r === null) {
    if (t === tp) return 0 // special case: zero-length road segment
    return (v-vp)/(t-tp)
  }
  return 0
}

/** Helper for fillroad for propagating forward filling in all the nulls */
const nextrow =  (or, nr) => {
  const tprev = or[0]
  const vprev = or[1]
  const rprev = or[2]
  const n     = or[3]

  const t = nr[0]
  const v = nr[1]
  const r = nr[2]
  const x = self.tvr(tprev, vprev, t,v,r) // the missing t, v, or r
  if (t === null) return [x, v, r, 0]
  if (v === null) return [t, x, r, 1]
  if (r === null) return [t, v, x, 2]
  return [t, v, x, 0]
}

/** Takes road matrix (with last row appended) and fills it in. Also adds a 
    column, n, giving the position (0, 1, or 2) of the original null. */
self.fillroad = (rd, g) => {
  rd.forEach(e => e[2] = null===e[2] ? e[2] : e[2]/g.siru)
  rd[0] = nextrow([g.tini, g.vini, 0, 0], rd[0])
  for (let i = 1; i < rd.length; i++) rd[i] = nextrow(rd[i-1], rd[i])
  rd.forEach(e => (e[2] = (null==e[2])?e[2]:e[2]*g.siru))

  // Remove rows that have timestamps before tini. This is temporary until
  // we clean up the goals in the database where this is an issue. After that
  // we should just fail loudly when we get a bb file that has any redline rows
  // with dates that are earlier than tini. Huge violation of the
  // anti-robustness principle [blog.beeminder.com/postel] to let Beebody send
  // broken graph matrices and clean them up here in Beebrain!
  while (rd !== undefined && rd[0] !== undefined && rd[0][0] < g.tini) 
    rd.shift()

  return rd
}

/** Version of fillroad that assumes tini/vini is the first row of road */
self.fillroadall = (rd, g) => {
  const tini = rd[0][0]
  const vini = rd[0][1]
  rd.splice(0,1)
  rd.forEach(e => (e[2] = null === e[2] ? e[2] : e[2]/g.siru))
  rd[0] = nextrow([tini, vini, 0, 0], rd[0])
  for (let i = 1; i < rd.length; i++) rd[i] = nextrow(rd[i-1], rd[i])
  rd.forEach(e => (e[2] = null === e[2] ? e[2] : e[2]*g.siru))
  rd.unshift([tini, vini, 0, 2])
  return rd
}

/** Computes the slope of the supplied road array at the given timestamp */
self.rtf = (rd, t) => (rd[self.findSeg(rd, t)].slope)

// Transform datapoints as follows: every time there's a decrease in value from
// one element to the next where the second value is zero, say V followed by 0,
// add V to every element afterwards. This is what you want if you're reporting
// odometer readings (eg, your page number in a book can be thought of that way)
// and the odometer gets accidentally reset (or you start a new book but want to
// track total pages read over a set of books). This should be done before
// kyoomify and will have no effect on data that has actually been kyoomified
// since kyoomification leaves no nonmonotonicities.
self.odomify = (d) => {
  if (!d || !d.length || d.length === 0) return
  let vdelt = 0 // current delta by which to shift everything given past resets
  let prev = d[0][1] // remember the previous value as we walk forward
  for (let i = 1; i < d.length; i++) {
    if (d[i][1] === 0) vdelt += prev
    prev = d[i][1]
    d[i][1] += vdelt
  }
}

// Utility function for stepify. Takes a list of datapoints sorted by x-value
// and a given x-value and finds the most recent y-value (the one with the 
// greatest x-value in d that's less than or equal to the given x). 
// It's like Mathematica's Interpolation[] with interpolation order 0.
// If the given x is strictly less than d[0][0], return d[0][1].
self.stepFunc = (d, x) => {
  const i = max(0, bu.searchLow(d, p=>p[0]-x))
  return d[i][1]
}

// Take a list of datapoints sorted by x-value and return a pure function that
// interpolates a step function from the data, always mapping to the most
// recent y-value.
self.stepify = (d) => !d || !d.length ? x => 0 : x => self.stepFunc(d, x)

// Given a road, a goal, a datapoint {t,v}, and an array of isolines, return the
// color that the datapoint should be plotted as. That depends on the isolines
// as follows: 
// * The 0th isoline is the bright red line so if you're on the wrong
//   side of that, you're red. 
// * Otherwise, if you're on the wrong side of the 1st isoline, you're orange.
// * Wrong side of the 2nd isoline, blue. 
// * Being just on the wrong side of the nth isoline means you have n safe days
//   and being exactly on it or just better is n+1 safe days. 
// * So being (on or) on the right side of the 6th isoline means you're immune
//   to the akrasia horizon.
self.dotcolor = (rd, g, t, v, iso=null) => {
  if (t < g.tini)   return bu.BHUE.BLCK // dots before tini have no color!
  if (iso === null) return self.aok(rd, g, t, v) ? bu.BHUE.BLCK : bu.BHUE.REDDOT
  if (!iso || !iso.length || iso.length < 1) return bu.BHUE.ERRDOT

  return self.isoside(g, iso[0], t, v) < 0 ? bu.BHUE.REDDOT : // 0 safe days
         self.isoside(g, iso[1], t, v) < 0 ? bu.BHUE.ORNDOT : // 1 safe day
         self.isoside(g, iso[2], t, v) < 0 ? bu.BHUE.BLUDOT : // 2 safe days
         self.isoside(g, iso[6], t, v) < 0 ? bu.BHUE.GRNDOT : // 3-6 safe days
                                             bu.BHUE.GRADOT   // 7+ safe days
}

// This was previously called isLoser
self.redyest = (rd, g, t, iso=null) => {
  return self.dotcolor(rd, g, t-SID, g.dtf(t-SID), iso) === bu.BHUE.REDDOT 
}

/**Previously known as noisyWidth before Yellow Brick Half-Plane for computing
   the road width for goals like weight loss with noisy data. Now it computes
   the so-called 90% Variance show in the Statistics tab. We also use stdflux to
   determine the width of the polynomial fit trend aka blue-green aura aka
   turquoise swath (it's twice stdflux, ie, stdflux in each direction).
   Specifically, we get the list of daily deltas between all the points, but
   adjust each delta by the road rate (eg, if the delta is equal to the delta
   of the road itself, that's an adjusted delta of 0). Return the 90% quantile
   of those adjusted deltas. */
self.stdflux = (rd, d) => {
  if (!d || !d.length || d.length <= 1) return 0
  const p = bu.partition(d, 2, 1)
  let ad = []
  let t, v, u, w
  for (let i = 0; i < p.length; i++) {
    t = p[i][0][0]
    v = p[i][0][1]
    u = p[i][1][0]
    w = p[i][1][1]
    ad.push(abs(w-v-self.rdf(rd,u)+self.rdf(rd,t))/(u-t)*SID)
  }
  return bu.chop(ad.length===1 ? ad[0] : bu.quantile(ad, 0.90))
}

// This should be safe to kill -- not used anywhere now.
/**Increase the width if necessary for the guarantee that you can't lose
   tomorrow if you're in the right lane today. Specifically, when you first
   cross from right lane to wrong lane (if it happened from one day to the
   next), the road widens if necessary to accommodate that jump and then the
   road width stays fixed until you get back in the right lane. So for this
   function that means if the current point is in the wrong lane, look
   backwards to find the most recent one-day jump from right to wrong. That
   wrong point's deviation from the centerline is what to max the default road
   width with. */
self.autowiden = (rd, g, d, nw) => {
  let n = d  // pretty sure we meant n = d.length here killing this anyway, so.
  if (n <= 1) return 0
  let i = -1
  if (self.gdelt(rd, g, d[d.length-1][0], d[d.length-1][1]) < 0) {
    while (i >= -n && self.gdelt(rd, g, d[i][0], d[i][1]) < 0) i -= 1
    i += 1
    if (i > -n && d[i][0] - d[i-1][0] <= SID) 
      nw = max(nw, abs(d[i][1] - self.rdf(rd,d[i][0])))
  }
  return bu.chop(nw)
}

/** Whether the road has a vertical segment at time t */
self.vertseg = (rd, t) => (rd.filter(e=>(e.sta[0] === t)).length > 1)

/**Used in grAura() and for computing mean & meandelt, add dummy datapoints
   on every day that doesn't have a datapoint, interpolating linearly. */
self.gapFill = (d) => {
  if (!d || !d.length) return []
  const interp = (bef, aft, atPt) => (bef + (aft - bef) * atPt)
  var start = d[0][0], end = d[d.length-1][0]
  var n = floor((end-start)/SID)
  var out = Array(n), i, j = 0, t = start
  for (i = 0; i < d.length-1; i++) {
    var den = (d[i+1][0]-d[i][0])
    while (t <= d[i+1][0]) {
      out[j] = [t, interp(d[i][1], d[i+1][1], (t-d[i][0])/den)]
      j++; t += SID
    }
  }
  if (out.length === 0) out.push(d[0])
  return out
}

/** Return a pure function that fits the data smoothly, used by grAura */
self.smooth = (d) => {
  if (!d || !d.length) return (x) => x
  const SMOOTH = (d[0][0] + d[d.length-1][0])/2
  const dz = bu.zip(d)
  const xnew = dz[0].map((e) => (e-SMOOTH)/SID)
  const poly = new Polyfit(xnew, dz[1])
  let solver = poly.getPolynomial(3)
  const range = abs(max(...dz[1])-min(...dz[1]))
  const error = poly.standardError(poly.computeCoefficients(3))
  if (error > 10000*range) {
    // Very large error. Potentially due to ill-conditioned matrices.
    console.log(
      "butil.smooth: Possible ill-conditioned polyfit. Reducing dimension.")
    solver = poly.getPolynomial(2)
  }

  return (x) => solver((x-SMOOTH)/SID)
}

/** Return a pure function that fits the data smoothly, used by grAura */
self.smooth2 = (d) => {
  if (!d || !d.length) return (x) => x
  const dz = bu.zip(d)
  const f = bu.splinefit(dz[0], dz[1])
  return (x) => x
}

/** Assumes both datapoints and the x values are sorted */
self.interpData = (d, xv) => {
  var interp = (bef, aft, atPt) =>(bef + (aft - bef) * atPt)
  var di = 0, dl = d.length, od = []
  if (dl === 0) return null
  if (dl === 1) return xv.map((d)=>[d, d[0][1]])
  for (let i = 0; i < xv.length; i++) {
    var xi = xv[i]
    if (xi <= d[0][0]) od.push([xi, d[0][1]])
    else if (xi >= d[dl-1][0]) od.push([xi, d[dl-1][1]])
    else if (xi < d[di+1][0] ) { 
      od.push([xi, interp(d[di][1], d[di+1][1],
                          (xi-d[di][0])/(d[di+1][0]-d[di][0]))])
    } else {
      while (xi > d[di+1][0]) di++
      od.push([xi, interp(d[di][1], d[di+1][1],
                          (xi-d[di][0])/(d[di+1][0]-d[di][0]))])
    }
  }
  return od
}

/**  The value of the YBR in n days */
self.lim = (rd, g, n) => { return self.rdf(rd, g.tcur+n*SID) }

/** The bare min needed from vcur to the critical edge of the YBR in n days */
self.limd = (rd, g, n) => { return self.lim(rd, g, n) - g.vcur }

/** Computes and returns a dueby array with n elements */
self.dueby = (rd, g, n) => {
  let db = [...Array(n).keys()]
      .map(i => [bu.dayify(g.tcur+i*SID),
                 self.limd(rd, g, i),
                 self.lim(rd, g, i)])
  const tmpdueby = bu.zip(db)
  return bu.zip([tmpdueby[0], bu.monotonize(tmpdueby[1],g.dir),
                 bu.monotonize(tmpdueby[2],g.dir)])
}
  
return self

})); // END MAIN ---------------------------------------------------------------

/**
 * Javascript implementation of Beebrain, provided as a UMD module.
 * Provides a {@link beebrain} class, which can be used to construct independent
 * Beebrain objects each with their own internal state.<br/>

@module beebrain
@requires moment
@requires butil
@requires broad

Beebrain -- doc.bmndr.com/beebrain
Originally written in Mathematica by dreeves, 2008-2010.
Ported to Python by Uluc Saranli around 2011.12.20.
Maintained and evolved by dreeves, 2012-2018.
Ported to Javascript in 2018-2019 by Uluc Saranli.

Copyright 2008-2022 Uluc Saranli and Daniel Reeves

*/

;(((root, factory) => { // BEGIN PREAMBLE --------------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("beebrain: Using AMD module definition")
  define(['fili', 'moment', 'butil', 'broad'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.
  //console.log("beebrain: Using CommonJS module.exports")
  module.exports = factory(require('./fili'),
                           require('./moment'), 
                           require('./butil'), 
                           require('./broad'))
} else {
  //console.log("beebrain: Using Browser globals")
  root.beebrain = factory(root.Fili, root.moment, root.butil, root.broad)
}

})(this, (fili, moment, bu, br) => { // END PREAMBLE -- BEGIN MAIN -------------

'use strict'

// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const max   = Math.max
const min   = Math.min
const abs   = Math.abs
const exp   = Math.exp
const floor = Math.floor
const ceil  = Math.ceil
const sign  = Math.sign

const DIY = 365.25 // this is what physicists use, eg, to define a light year
const SID = 86400 // seconds in a day (not used: DIM=DIY/12, WIM=DIY/12/7)

// -----------------------------------------------------------------------------
// ---------------------- BEEBRAIN CONSTANTS AND GLOBALS -----------------------

let gid = 1 // Global counter giving unique IDs for multiple Beebrain instances

// -----------------------------------------------------------------------------
// In-params and out-params are documented at doc.bmndr.com/beebrain

// NOTES / IDEAS:
// o Recommend stdflux for user-specified maxflux in the UI.
// o Gaps in the Graph: If you derail and don't immediately rerail, the BRL 
//   should show a gap when you weren't beeminding. The graph matrix could
//   indicate this with a row like {t, null, null} which means no segment should
//   be drawn between the previous row's time and time t. For the purposes of
//   computing the following row, the null row should be treated as {t, null,
//   0}. Or just have a 4th column for graph matrix indicating if segment is a
//   gap?
// o Pass in a "backroad" parameter that's a version of the road that's never 
//   allowed to change retroactively. The first thing to do with that is to use
//   it to color historical datapoints with their original color (aka
//   permacolor)
// o Some of these in-params have null as a default but don't actually allow 
//   null, meaning that it's an error to not specify those in-params. Would it
//   be better to be explicit and distinguish? Null could mean that null is a
//   valid default and if we require the in-param to be explicitly specified we
//   could have the default below be a magic string like '_DEFAULT_DISALLOWED_'
//   or '_NOD_' or maybe just anything that will obviously fail the error check?
// o Any changes to the in-params (pin) should also be reflected in the error-
//   checking (pchex) below.

const pin = { // In Params: Graph settings and their defaults
quantum  : 1e-5,   // Precision/granularity for conservarounding baremin etc
timey    : false,  // Whether numbers should be shown in HH:MM format
ppr      : true,   // Whether PPRs are turned on (ignored if not WEEN/RASH)
deadline : 0,      // Time of deadline given as seconds before or after midnight
asof     : null,   // Compute everything as if it were this date; future ghosty
tini     : null,   // (tini,vini) specifies the start of the BRL, typically but
vini     : null,   //   not necessarily the same as the initial datapoint
road     : [],     // List of (endTime,goalVal,rate) triples defining the BRL
tfin     : null,   // Goal date (unixtime); end of the Bright Red Line (BRL)
vfin     : null,   // The actual value being targeted; any real value
rfin     : null,   // Final rate (slope) of the BRL before it hits the goal
runits   : 'w',    // Rate units for road and rfin; one of "y","m","w","d","h"
gunits   : 'units',// Goal units like "kg" or "hours"
yaw      : 0,      // Which side of the BRL you want to be on, +1 or -1
dir      : 0,      // Which direction you'll go (usually same as yaw)
pinkzone : [],     // Region to shade pink, specified like the graph matrix
tmin     : null,   // Earliest date to plot on the x-axis (unixtime):
tmax     : null,   //   ((tmin,tmax), (vmin,vmax)) give the plot range, ie, they
vmin     : null,   //   control zooming/panning; they default to the entire
vmax     : null,   //   plot -- initial datapoint to past the akrasia horizon
kyoom    : false,  // Cumulative; plot values as the sum of those entered so far
odom     : false,  // Treat zeros as accidental odom resets
maxflux  : 0,      // User-specified max daily fluctuation                      
monotone : false,  // Whether the data is necessarily monotone (used in limsum) 
aggday   : null,   // How to aggregate points on the same day, max/sum/last/etc
plotall  : true,   // Plot all the points instead of just the aggregated point
steppy   : false,  // Join dots with purple steppy-style line
rosy     : false,  // Show the rose-colored dots and connecting line
movingav : false,  // Show moving average line superimposed on the data
aura     : false,  // Show blue-green/turquoise (now purple I guess) aura/swath
hashtags : true,   // Show annotations on graph for hashtags in datapt comments 
yaxis    : '',     // Label for the y-axis, eg, "kilograms"
waterbuf : null,   // Watermark on the good side of the BRL; safebuf if null
waterbux : '',     // Watermark on the bad side, ie, pledge amount
hidey    : false,  // Whether to hide the y-axis numbers
stathead : true,   // Whether to add a label w/ stats at top of graph (DEV ONLY)
yoog     : 'U/G',  // Username/graphname, eg, "alice/weight"                
goal     : null,   // Synonym for vfin ##################################### DEP
rate     : null,   // Synonym for rfin ##################################### DEP
}

const pout = { // Out Params: Beebrain output fields
sadbrink : false,   // Whether we were red yesterday & so will instaderail today
safebump : null,    // Value needed to get one additional safe day
dueby    : [],      // Table of daystamps, deltas, and abs amts needed by day
fullroad : [],      // Road matrix w/ nulls filled in, [tfin,vfin,rfin] appended
pinkzone : [],      // Subset of the road matrix defining the verboten zone
tluz     : null,    // Timestamp of derailment ("lose") if no more data is added
tcur     : null,    // (tcur,vcur) gives the most recent datapoint, including
vcur     : null,    //   flatlining; see asof 
vprev    : null,    // Agged value yesterday 
rcur     : null,    // Rate at time tcur; if kink, take the limit from the left
ravg     : null,    // Overall red line rate from (tini,vini) to (tfin,vfin)
tdat     : null,    // Timestamp of last actually entered datapoint pre-flatline
stdflux  : 0,       // Recommended maxflux, .9 quantile of rate-adjusted deltas
delta    : 0,       // How far from the red line: vcur - rdf(tcur)
lane     : 666,     // Lane number for backward compatibility
cntdn    : 0,       // Countdown: # of days from tcur till we reach the goal
numpts   : 0,       // Number of real datapoints entered, before munging
mean     : 0,       // Mean of datapoints
meandelt : 0,       // Mean of the deltas of the datapoints
proctm   : 0,       // Unixtime when Beebrain was called (specifically genStats)
statsum  : '',      // Human-readable graph stats summary (not used by Beebody)
ratesum  : '',      // Text saying what the rate of the red line is
deltasum : '',      // Text saying where you are wrt the red line
graphsum : '',      // Text at the top of the graph image; see stathead
progsum  : '',      // Text summarizing percent progress, timewise and valuewise
safesum  : '',      // Text summarizing how safe you are (NEW!)
rah      : 0,       // Y-value of the bright red line at the akrasia horizon
safebuf  : null,    // Number of days of safety buffer
error    : '',      // Empty string if no errors generating the graph
limsum   : '',      // Text saying your bare min or hard cap ############### DEP
headsum  : '',      // Text in the heading of the graph page ############### DEP
titlesum : '',      // Title text for graph thumbnail ###################### DEP
lnw      : 0,       // Lane width at time tcur ############################# DEP
color    : 'black', // One of {"green", "blue", "orange", "red"} ########### DEP
loser    : false,   // Whether you're irredeemably off the road ############ DEP
gldt     : null,    // {gldt, goal, rate} are synonyms for ################# DEP
goal     : null,    //   for the last row of fullroad ###################### DEP
rate     : null,    //   like a filled-in version of {tfin, vfin, rfin} #### DEP
road     : [],      // Synonym for fullroad ################################ DEP
tini     : null,    // Echoes input param ################################## DEP
vini     : null,    // Echoes input param ################################## DEP
tfin     : null,    // Subsumed by fullroad ################################ DEP
vfin     : null,    // Subsumed by fullroad ################################ DEP
rfin     : null,    // Subsumed by fullroad ################################ DEP
//graphurl : null,  // Nonce URL for the graph image, based on the provided slug
//thumburl : null,  // Nonce URL for the graph image thumbnail
}

const pig = [ // In Params to ignore; complain about anything not here or in pin
'timezone', // Beebody sends this but we don't use it currently
//'rerails',  // Idea for something to be passed to Beebrain
'usr',      // Username (old synonym for first half of yoog)
'graph',    // Graph name (old synonym for second half of yoog)
'ybhp',     // Boolean used for the yellow brick half-plane transition
'integery', // Replaced by 'quantum'; fully killed as of 2020-08-21
'noisy',    // Pre-YBHP; fully killed as of 2020-08-20
'abslnw',   // Pre-YBHP; fully killed as of 2020-08-19
'tagtime',  // Used in the very early days
'backroad', // Related to the permacolor idea; see doc.bmndr.com/permacolor
'edgy',     // Ancient; killed as one of the prereqs for YBHP
'offred',   // Used for the transition to the red-yesterday derail condition
//'offparis', // Temporary thing related to red-yesterday
'sadlhole', // Allowed the do-less loophole where you could eke back on the road
'imgsz',    // Image size (default 760); width in pixels of graph image
]

/** Enum object to identify different types of datapoints
    @enum {number} 
    @memberof beebrain */
const DPTYPE = {
  AGGPAST:0, AGGFUTURE:1, RAWPAST:2, RAWFUTURE:3, FLATLINE:4, HOLLOW: 5
}

/** Enum object to identify error types */
const ErrType = { NOBBFILE:0, BADBBFILE:1  }

/** Enum object to identify error types */
const ErrMsgs = [ "Could not find goal (.bb) file.", "Bad .bb file." ]

/** Type of the last error */
const LastError = null

const PRAF = .015 // Fraction of plot range that the axes extend beyond

/** beebrain object constructor. Processes the supplied goal information JSON
 * and computed derived goal parameters, summaries, and other details. These
 * results can be accessed through various public members and methods.

 @memberof module:beebrain
 @constructs beebrain
 @param {Object} bbin JSON input "BB file" with goal details
*/
const beebrain = function( bbin ) { // BEGIN beebrain object constructor -------

//console.debug("beebrain constructor ("+gid+"): ");
let self = this
let curid = gid
gid++

bbin = bu.deepcopy(bbin) // Make new copy of the input to prevent overwriting

// Private variables holding goal, road, and datapoint info
let roads = []      // Beebrain-style road data structure w/ sta/end/slope/auto
let gol = {}        // Goal parameters passed to Beebrain
let alldata = []    // Entire set of datapoints passed to Beebrain
let data = []       // Past aggregated data
let rosydata = []   // Derived data corresponding to the rosy line
let fuda = []       // Future data
let undoBuffer = [] // Array of previous roads for undo
let redoBuffer = [] // Array of future roads for redo
let oresets = []    // Odometer resets
let derails = []    // Derailments
let hollow = []     // Hollow points
let allvals = {}    // Hash mapping timestamps to list of datapoint values
let aggval = {}     // Hash mapping timestamps to aggday'd value for that day
let derailval = {}  // Map timestamp to value as of DERAIL datapoint that day
let hashhash = {}   // Map timestamp to sets of hashtags to display on graph
let hashtags = []   // Array of timestamp string pairs for hashtag lists
 
// Initialize gol with sane values
gol.yaw = +1; gol.dir = +1
gol.tcur = 0; gol.vcur = 0; gol.vprev = 0
const now = moment.utc()
now.hour(0); now.minute(0); now.second(0); now.millisecond(0)
gol.asof = now.unix()
gol.horizon = gol.asof+bu.AKH
gol.xMin =    gol.asof;  gol.xMax = gol.horizon
gol.yMin =    -1;        gol.yMax = 1

/**Convert legacy parameters to modern counterparts for backward compatibility.
   @param {Object} p Goal parameters from the bb file */
function legacyIn(p) {
  if ('goal' in p && !('vfin' in p))                 p.vfin = p.goal
  if ('rate' in p && !('rfin' in p))                 p.rfin = p.rate
//if ('usr'  in p && 'graph' in p && !('yoog' in p)) p.yoog = p.usr+"/"+p.graph
}
  
// Helper function for legacyOut
function rowfix(row) {
  if (!Array.isArray(row)) return row
  if (row.length <= 3)     return row
  return row.slice(0,3)
}

/** Last in genStats, filter params for backward compatibility
    @param {Object} p Computed goal statistics */
function legacyOut(p) {
  p.fullroad = p.fullroad.map( r=>rowfix(r) )
  p['road']     = p['fullroad']
  if (p['error']) {
    p['gldt'] = bu.dayify(gol.tfin)
    p['goal'] = gol.vfin
    p['rate'] = gol.rfin*gol.siru
  } else {
    const len = p['fullroad'].length
    if (len > 0) {
      p['gldt'] = p['fullroad'][len-1][0]
      p['goal'] = p['fullroad'][len-1][1]
      p['rate'] = p['fullroad'][len-1][2]
    }
  }
  p['tini'] = bu.dayify(gol.tini)
  p['vini'] = gol.vini
  p['tfin'] = bu.dayify(gol.tfin)
  p['vfin'] = gol.vfin
  p['rfin'] = gol.rfin
}

/** Initialize various global variables before use */
function initGlobals() {
  // Data related variables
  data = []
  flad = null
  fuda = []
  allvals = {}
  aggval = {}
  derailval = {}
  
  gol = {}
  gol.siru = null
  oresets = []
  derails = []
  hashhash = {}
  
  // All the in and out params are also global, via the gol hash
  for (const key in pout) gol[key] = pout[key]
  for (const key in pin)  gol[key] = pin[key]
}

function parserow(row) {
  return !Array.isArray(row) || row.length !== 3 ? row : 
                                           [bu.dayparse(row[0]), row[1], row[2]]
}

// Helper function for stampOut
function dayifyrow(row) {
  if (row.length < 1) return row
  let newrow = row.slice()
  newrow[0] = bu.dayify(row[0])
  return newrow
}

/** Processes fields with timestamps in the input
 @param {Object} p Goal parameters from the BB file
 @param {Array} d Datapoints from the BB file */
function stampIn(p, d) {
  ['asof', 'tini', 'tfin', 'tmin', 'tmax']
    .map(e => { if (e in p) p[e] = bu.dayparse(p[e]) })
  if ('road' in p && bu.listy(p.road)) p.road = p.road.map(parserow)
  
  // Stable-sort by timestamp before dayparsing the timestamps because
  // if the timestamps were actually given as unixtime then dayparse
  // works like dayfloor and we lose fidelity. We also augment the
  // data array with the index, unprocessed value and the datapoint id
  // if it exists, the index otherwise
  return d
    .map((r,i) => [bu.dayparse(r[0]),r[1],r[2],i,r[1]]) // Store indices
    .sort((a,b) => (a[0]!== b[0] ? a[0]-b[0] : a[3]-b[3])) 
}

/** Convert unixtimes back to daystamps
    @param {Object} p Computed goal statistics */
function stampOut(p) {
  p['fullroad'] = p['fullroad'].map(dayifyrow)
  if ('razrmatr' in pout) p['razrmatr'] = p['razrmatr'].map(dayifyrow)
  p['pinkzone'] = p['pinkzone'].map(dayifyrow)
  p['tluz'] = bu.dayify(p['tluz'])
  p['tcur'] = bu.dayify(p['tcur'])
  p['tdat'] = bu.dayify(p['tdat'])
}

// Exponentially-weighted Moving Average; returns smoothed value at x.
// Very inefficient since we recompute the whole moving average up to x for
// every point we want to plot.
function ema(d, x) {
  // The Hacker's Diet recommends 0.1; Uluc had .0864
  // forum.beeminder.com/t/control-exp-moving-av/2938/7 suggests 0.25
  let KEXP = .25/SID 
  if (gol.yoog==='meta/derev')   KEXP = .03/SID   // .015 for meta/derev
  if (gol.yoog==='meta/dpledge') KEXP = .03/SID   // .1 jagged
  let xp = d[0][0]
  let yp = d[0][1]
  let prev = yp, dt, i, ii, A, B
  if (x < xp) return prev
  for (ii = 1; ii < d.length; ii++) { // compute line equation
    i = d[ii]
    dt = i[0] - xp
    A = (i[1]-yp)/dt  // (why was this line marked as a to-do?)
    B = yp
    if (x < i[0]) { // found interval; compute intermediate point
      dt = x-xp
      return B+A*dt-A/KEXP + (prev-B+A/KEXP) * exp(-KEXP*dt)
    } else { // not the current interval; compute next point
      prev = B+A*dt-A/KEXP + (prev-B+A/KEXP) * exp(-KEXP*dt)
      xp = i[0]
      yp = i[1]
    }
  }
  // keep computing exponential past the last datapoint if needed
  dt = x-xp
  return B + A*dt - A/KEXP + (prev-B+A/KEXP) * exp(-KEXP*dt)
}

// Function to generate samples for the Butterworth filter
function griddlefilt(a, b) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 40, 2000)))
}

// Function to generate samples for the Butterworth filter
function griddle(a, b, maxcnt = 6000) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 
                                         min(600, /*plotbox.width*/ 640),
                                         maxcnt)))
}

// Based on the Mathematica function. Take a 2-argument function f, an initial
// argument x, and a list l of next arguments to fold in:
// foldlist(f, x, [e1, e2, ...]) -> [x, f(x,e1), f(f(x,e1), e2), ...] 
function foldlist(f, x, l) {
  let out = [x]
  for (let i = 0; i < l.length; i++) out.push(f(out[i], l[i]))
  return out
}

// Start at the first datapoint plus sign*delta and walk forward making the next
// point be equal to the previous point, clipped by the next point plus or minus
// delta. Used for the rose-colored dots.
function inertia0(data, delta, sign) {
  return foldlist((a, b) => bu.clip(a, b-delta, b+delta),
                  data[0]+sign*delta, data.slice(1, data.length))
}
function inertia(data, delta, sign) {
  let tdata = bu.zip(data) // transpose of data
  tdata[1] = inertia0(tdata[1], delta, sign)
  return bu.zip(tdata)
}
// Same thing but start at the last datapoint and walk backwards
function inertiaRev(data, delta, sign) {
  return inertia(data.slice().reverse(), delta, sign).reverse()
}

/** Pre-compute rosy datapoints */
function computeRosy() {
  if (!gol.rosy || data.length == 0) return
  // Pre-compute rosy datapoints
  const delta = max(0, gol.stdflux)
  let lo, hi
  if (gol.dir > 0) { lo = inertia(   data, delta, -1)
                     hi = inertiaRev(data, delta, +1)
  } else           { lo = inertiaRev(data, delta, -1)
                     hi = inertia(   data, delta, +1)
  }
  const yveclo = lo.map(e => e[1])
  const yvechi = hi.map(e => e[1])
  const yvec = bu.zip([yveclo, yvechi]).map(e => (e[0]+e[1])/2)
  const xvec = data.map(e => e[0])
  rosydata = bu.zip([xvec, yvec])
  // rosydata format: [ptx, pty, popup text, pt type, prevx, prevy, v(original)]
  // It's essentially the same as normal datapoints. Previous point coordinates
  // are needed to draw connecting lines.
  rosydata = rosydata.map(e => 
                       [e[0],e[1],"rosy data", DPTYPE.RAWPAST, e[0],e[1], e[1]])
  for (let i = 1; i < rosydata.length-1; i++) {
    // These elements store the preceding point to facilitate drawing with d3
    rosydata[i][4] = rosydata[i-1][0]
    rosydata[i][5] = rosydata[i-1][1]
  }
}

// Magic strings in datapoint comments: (see beeminder/beeminder/issues/2423)
// 1. "#SELFDESTRUCT" (and for backward compat: /^PESSIMISTIC PRESUMPTION/)
// 2. "#DERAIL" (and for backward compatibility: /^RECOMMITTED ON/)
// 3. "#RESTART" (and for backward compatibility: /^RESTARTED ON/)
// 4. "#TARE" (not implemented yet; see gissue #216)
// 5. (/^RESTART PLACEHOLDER/ has been thankfully killed)

// Take, eg, "shark jumping #yolo :) #shark" and return {"#yolo", "#shark"}
// Pro tip: use scriptular.com to test these regexes
let hashtagRE
try {
  //hashtagRE = /(?:^|\s)(#\p{L}[\p{L}0-9_]+)(?=$|\s)/gu
  hashtagRE = new RegExp(
    //"(?:^|\\s)(#\\p{L}[\\p{L}0-9_]*)(?=$|\\s)", "gu")
      "(?:^|\\s)(#\\p{L}[\\p{L}0-9_]*)(?=$|[\\s])", "gu")
    //"(?:^|\\s)(#\\p{L}[\\p{L}0-9_]*)(?=$|\\s|\\.|\\!|\\,|\\:|\\))", "gu")
} catch { // Firefox couldn't handle the above in 2019 so just in case:
  hashtagRE = 
      /(?:^|\s)(#[a-zA-Z]\w*)(?=$|\s)/g  // version not allowing punctuation
    ///(?:^|\s)(#[a-zA-Z]\w*)(?=$|\s|\.|\!|\,|\:|\))/g
}
function hashextract(s) {
  let set = new Set(), m
  hashtagRE.lastIndex = 0
  while ( (m = hashtagRE.exec(s)) != null ) if (m[1] != "") set.add(m[1])
  return set
}

// Whether datapoint comment string s has the magic string indicating it's when
// a derailment happened (previously known as a recommit datapoint).
function rerailed(s) { 
  return /(?:^|\s)#DERAIL(?=$|\s)/.test(s) ||
    s.startsWith("RECOMMITTED ON") // backward compatibility; see magic strings
}

// Convenience function to extract values from datapoints
function dval(d) { return d[1] }

// Compute [informative comment, originalv (or null)] for aggregated points
function aggpt(vl, v) { // v is the aggregated value
  const kyoomy = gol.kyoom && gol.aggday === "sum"
  if (vl.length === 1) return [vl[0][2], vl[0][3], vl[0][4]]
  else {
    let i
    // check if agg'd value is also an explicit datapoint for today
    if (kyoomy) i = bu.accumulate(vl.map(dval)).indexOf(v)
    else        i = vl.map(dval).indexOf(v)
    // if not, aggregated point stands alone
    if (i < 0) return [gol.aggday, null, null]
    // if found, append (aggday) to comment and record original value
    else {
      return [vl[i][1]+" ("+gol.aggday+")", vl[i][3], vl[i][4]]
    }
  } // first change; second change
}

// WIP: This is the subset of procData that takes the raw datapoints -- a list
// of timestamp, value, comment triples -- and returns what's actually plotted
// on the y-axis, accounting for kyoom, odom, and aggday.
// UPDATE: Ugh, I'm not sure it's possible to refactor this part out as a 
// separate function without taking an extra pass through the datapoints.
// Regardless, it would be very nice to have this available as a separate thing,
// like for Beeminder's API to provide both raw data, like it does now, and 
// processed/aggregated data, giving what's actually plotted on the y-axis.
/*
function aggData(data) {
  if (!data || !data.length) return data
  
}
*/

// Walk through the list of datapoints (stored in the gobal "data") converting
// them as follow:
//    IN: [t, v, comment, original index, v(original), id] 
//   OUT: [t, v, comment, type, prevt, prevv, v(original) or null, index]
// Each datapoint records coordinates for the preceding point to enable
// connecting plots such as steppy and rosy even after filtering based on
// visibility in graph. v(original) is the datapoint value before aggregated
// values etc. are computed. Finally, index is the array index of the datapoint
// in the input data array.
function procData() { 
  if (!data || !data.length) return "No datapoints"
  const n = data.length
  let i

  for (i = 0; i < n; i++) {
    const d = data[i]
    // Sanity check data element
    if (!(bu.nummy(d[0]) && d[0]>0 && bu.nummy(d[1]) && bu.stringy(d[2])))
      return "Invalid datapoint: "+d[0]+" "+d[1]+' "'+d[3] 

    if (gol.hashtags) {                           // extract and record hashtags
      const hset = hashextract(d[2])
      if (hset.size == 0) continue
      if (!(d[0] in hashhash)) hashhash[d[0]] = new Set()
      for (const x of hset) hashhash[d[0]].add(x)
    }
  }

  // Precompute list of [t, hashtext] pairs for efficient display
  if (gol.hashtags) {
    hashtags = []
    for (const key in hashhash)
      hashtags.push([key, Array.from(hashhash[key]).join(' ')])
  }

  // Identify derailments and construct a copied array
  derails = data.filter(e => rerailed(e[2]))
  derails = derails.map(e => e.slice())
  // Legacy adjustment for before we switched from defining derailment as today
  // and yesterday being in the red to just yesterday in the red. As of 2021
  // there are still current graphs that become messed up without this...
  for (i = 0; i < derails.length; i++)
    if (derails[i][0] < 1562299200/*2019-07-05*/) derails[i][0] -= SID
  
  if (gol.odom) {               // identify, record, and process odometer resets
    oresets = data.filter(e => e[1] == 0).map(e => e[0])
    br.odomify(data)
  }
  const nonfuda = data.filter(e => e[0] <= gol.asof)
  if (gol.plotall) gol.numpts = nonfuda.length
  
  allvals = {}
  aggval = {}

  // Aggregate datapoints and handle kyoom
  let newpts = []
  let ct = data[0][0] // Current Time
  let vl = []  // Value List: All values [t, v, c, ind, originalv] for time ct 
        
  let pre = 0 // Current cumulative sum
  let prevpt

  // HACK: aggday=skatesum needs to know rcur which we won't know until we do
  // procParams. We do know rfin so we're making do with that for now...
  br.rsk8 = gol.rfin * SID / gol.siru // convert rfin to daily rate

  // Process all datapoints
  for (i = 0; i <= n; i++) {
    if (i < n && data[i][0] == ct)
      vl.push(data[i].slice()) // record all points for current timestamp in vl
    
    if (i >= data.length || data[i][0] != ct) {
      // Done recording all data for today
      let vlv = vl.map(dval)              // extract all values for today
      let ad  = br.AGGR[gol.aggday](vlv)  // compute aggregated value
      // Find previous point to record its info in the aggregated point
      if (newpts.length > 0) prevpt = newpts[newpts.length-1]
      else prevpt = [ct, ad+pre]
      // pre remains 0 for non-kyoom
      let ptinf = aggpt(vl, ad)
      // Create new datapoint
      newpts.push([ct, pre+ad, ptinf[0], // this is the processed datapoint
                   ct <= gol.asof ? DPTYPE.AGGPAST : DPTYPE.AGGFUTURE, 
                   prevpt[0], prevpt[1], // this is the previous point
                   ptinf[2],             // v(original)
                   ptinf[1]])            // index of original pt if coincident
      
      // Update allvals and aggval associative arrays
      // allvals[timestamp] has entries [vtotal, comment, vorig]
      if (gol.kyoom) {
        if (gol.aggday === "sum")
          allvals[ct] = 
            bu.accumulate(vlv).map((e,j) => 
                                      [ct, e+pre, vl[j][2], vl[j][3], vl[j][4]])
        else allvals[ct] = vl.map(e => [ct, e[1]+pre, e[2], e[3], e[4]])
        aggval[ct] = pre+ad
        pre += ad
      } else {
        allvals[ct] = vl
        aggval[ct] = ad
      }
      const vw = allvals[ct].map(e => e[1])

      // What we actually want for derailval is not this "worstval" but the
      // agg'd value up to and including the rerail (nee recommit) datapoint 
      // (see the rerailed() function) and nothing after that:
      derailval[ct] = gol.yaw < 0 ? bu.arrMax(vw) : bu.arrMin(vw)
      
      if (i < data.length) {
        ct = data[i][0]
        vl = [data[i].slice()]
      }
    }
  }
    
  // Recompute an array of all datapoints based on allvals, having incorporated
  // aggregation and other processing steps.
  let allpts = []
  for (let t in allvals) {
    allpts = allpts.concat(allvals[t].map(d => 
      [Number(t), d[1], d[2], 
       Number(t) <= gol.asof ? DPTYPE.AGGPAST : DPTYPE.AGGFUTURE,
       null, null, d[4], d[3]]))
  }
  alldata = allpts

  fuda = newpts.filter(e => e[0] >  gol.asof)
  data = newpts.filter(e => e[0] <= gol.asof)
  if (!gol.plotall) gol.numpts = data.length
  if (data.length == 0) { // all datapoints are in the future
    gol.tdat = gol.tcur
    gol.mean = 0
    hollow = []
    return ""
  }
  
  // Compute data mean after filling in gaps
  const gfd = br.gapFill(data)
  const gfdv = gfd.map(e => (e[1]))
  if (data.length > 0) gol.mean = bu.mean(gfdv)
  if (data.length > 1)
    gol.meandelt = bu.mean(bu.partition(gfdv,2,1).map(e => e[1] - e[0]))
  
  // time of last entered datapoint pre-flatline (so ignoring future data)
  gol.tdat = data[data.length-1][0]
  
  // Adjust derailment markers to indicate worst value for that day
  for (i = 0; i < derails.length; i++) {
    const CHANGEDATE = 1562299200 // 2019-07-05 // yuck, DRY this up
    if (derails[i][0] < CHANGEDATE) ct = derails[i][0]+SID
    else                            ct = derails[i][0]
    if (ct in derailval)
      //derails[i][1] = derailval[ct] // see "What we actually want" above...
      derails[i][1] = aggval[ct]  // doing this until derailval is done right
  }
  
  // Extract computed points that're different than any entered data
  hollow = data.filter(e => {
    if (!(e[0] in allvals)) return false
    return (e[0]<gol.asof && !allvals[e[0]].map(e => e[1]).includes(e[1]))
  })

  return ""
}

/** Extracts segments from the supplied graph matrix in the input
 * parameters as well as tini and vini. Upon completion, the 'roads' variable
 * contains an array of road segments as javascript objects in the following
 * format:<br/>
 
 {sta: [startt, startv], end: [endt, endv], slope, auto}<br/>
 
 Initial and final flat segments are added from starting days
 before tini and ending after 100 days after tfin.
 @param {Array} json Unprocessed graph matrix from the BB file
*/
function procRoad(json) {
  //const BDUSK = bu.dayparse(bu.dayify(bu.BDUSK)) // make sure it's dayfloored.
  const BDUSK = bu.BDUSK
  roads = []
  const rdData = json
  if (!rdData) return "Road param missing"
  const nk = rdData.length
  let firstsegment
  let tini = gol.tini
  let vini = gol.vini
  // Handle cases where first graph matrix row starts earlier than (tini,vini)
  if (rdData[0][0] != null && rdData[0][0] < tini) {
    tini = rdData[0][0]
    if (rdData[0][1] != null) vini = rdData[0][1]
  }
  // First segment starts from [tini-100days, vini], ends at [tini, vini]
  firstsegment = { sta: [tini, Number(vini)],
                   slope: 0, 
                   auto: br.RP.SLOPE }
  firstsegment.end = firstsegment.sta.slice()
  firstsegment.sta[0] = bu.daysnap(firstsegment.sta[0]-100*SID*DIY) // 100y?
  roads.push(firstsegment)
  for (let i = 0; i < nk; i++) {
    // Each segment i starts from the end of the previous segment and continues
    // until road[i], filling in empty fields in the graph matrix
    let seg = {}
    seg.sta = roads[roads.length-1].end.slice()
    let rddate = null, rdvalue = null, rdslope = null
    
    rddate  = rdData[i][0]
    rdvalue = rdData[i][1]
    rdslope = rdData[i][2]
    
    if (rddate == null) {
      seg.end = [0, Number(rdvalue)]
      seg.slope = Number(rdslope) / gol.siru
      if (seg.slope != 0) {
        seg.end[0] = seg.sta[0] + (seg.end[1] - seg.sta[1]) / seg.slope
      } else {
        // Hack to handle tfin=null and inconsistent values
        seg.end[0] = BDUSK
        seg.end[1] = seg.sta[1]
      }
      seg.end[0] = min(BDUSK, seg.end[0])
      // Readjust the end value in case we clipped the date to BDUSK
      seg.end[1] = seg.sta[1] + seg.slope*(seg.end[0]-seg.sta[0])
      seg.auto = br.RP.DATE
    } else if (rdvalue == null) {
      seg.end = [rddate, 0]
      seg.slope = Number(rdslope)/(gol.siru)
      seg.end[1] = seg.sta[1] + seg.slope*(seg.end[0]-seg.sta[0])
      seg.auto = br.RP.VALUE
    } else if (rdslope == null) {
      seg.end = [rddate, Number(rdvalue)]
      seg.slope = br.segSlope(seg)
      seg.auto = br.RP.SLOPE
    } 
    // Skip adding segment if it is earlier than the first segment
    if (seg.end[0] >= seg.sta[0]) roads.push(seg)
  }
  // Extract computed values for tfin, vfin and rfin
  const golseg = roads[roads.length-1]
  
  // A final segment is added, ending 100 days after tfin
  const finalsegment = { sta: golseg.end.slice(),
                         end: golseg.end.slice(),
                         slope: 0, 
                         auto: br.RP.VALUE }
  finalsegment.end[0] = bu.daysnap(finalsegment.end[0]+100*SID*DIY) // 100y?
  roads.push(finalsegment)
  
  //br.printRoad(roads)
  return ""
}

// Add a flatlined datapoint today if the last datapoint is before today.
// But don't keep flatlining past a derailment unless doing so will eventually
// put you back on the right side of the bright red line, like if the goal is
// restarted and the red line reset. That's nicer to stop the flatlining early
// if possible because maybe you derailed years ago and by not flatlining past
// that point you can actually see that ancient derailment on the graph. If we
// always flatlined to today, the graph would look dumb/boring, with everything
// interesting squished to the left and then a years-long flatline with a little
// triangle at the end. 
// PS: We currently only do this fanciness for UPTOP/DNLOW (aka MOAR/PHAT)
// because for UPLOW/DNTOP (aka WEEN/RASH) we'd have to deal with PPRs I guess?
let flad = null // Holds the flatlined datapoint if it exists
function flatline() {
  const lastpt = data.length === 0 ? [gol.tini, gol.vini] : data[data.length-1]
  const tlast  = lastpt[0]
  const vlast  = lastpt[1]
  if (tlast > gol.tfin) return // no flatlining past the end of the goal
  const tcurr  = min(gol.asof, gol.tfin) // flatline at most this far
  const red = (t) => !br.aok(roads, gol, t, vlast) // convenience function

  let tflat = tcurr // the time we're flatlining to, walking backward from here
  if (gol.yaw * gol.dir > 0) { // UPTOP (MOAR) and DNLOW (PHAT)
    while (red(tflat -   SID) && tflat-SID > tlast &&
           red(tflat - 2*SID) && tflat-SID > gol.tini) {
      tflat -= SID
    }
  }

  if (!(tflat in aggval)) { // only make a flatline point if no actual datapoint
    flad = [tflat, vlast, "PPR", DPTYPE.FLATLINE, tlast, vlast, null]
    // Check if a PPR was already added and if so, replace
    if (tlast == tflat && lastpt[2] == "PPR") data[data.length-1] = flad
    else data.push(flad)
  }
}

/** Set any of {tmin, tmax, vmin, vmax} that don't have explicit values.
 * Duplicates Pybrain's setRange() behavior. */
function setDefaultRange() {
  if (gol.tmin == null) gol.tmin = min(gol.tini, gol.asof)
  if (gol.tmax == null) {
    // Make more room beyond the askrasia horizon if lots of data
    const years = floor((gol.tcur - gol.tmin) / (DIY*SID))
    gol.tmax = bu.daysnap((1+years/2)*2*bu.AKH + gol.tcur)
  }
  if (gol.vmin != null && gol.vmax != null) {     // both provided explicitly
    if (gol.vmin == gol.vmax) {
      gol.vmin -= 1; gol.vmax += 1                // scooch away from each other
    } else if (gol.vmin > gol.vmax) {
      [gol.vmin, gol.vmax] = [gol.vmax, gol.vmin] // swap them
    }
    return
  }
  
  const PRAF = 0.015
  const a = br.rdf(roads, gol.tmin)
  const b = br.rdf(roads, gol.tmax)
  const d0 = data.filter(e => e[0] <= gol.tmax && e[0] >= gol.tmin)
                 .map(e => e[1])
  let mind = bu.arrMin(d0)
  let maxd = bu.arrMax(d0)
  // Make room for the ghosty PPR datapoint
  if (flad != null && flad[0] <= gol.tmax && flad[0] >= gol.tmin) {
    const pprv = flad[1] + br.ppr(roads, gol, gol.asof)
    mind = min(mind, pprv) // Make room for the 
    maxd = max(maxd, pprv) // ghosty PPR datapoint.
  }
  const padding = max(0, (maxd-mind)*PRAF*2)
  let minmin = mind - padding
  let maxmax = maxd + padding
  if (gol.monotone && gol.dir>0) {            // Monotone up so no extra padding
    minmin = bu.arrMin([minmin, a, b])        // below (the low) vini.
    maxmax = bu.arrMax([maxmax, a, b])
  } else if (gol.monotone && gol.dir<0) {     // Monotone down so no extra
    minmin = bu.arrMin([minmin, a, b])        // padding above (the
    maxmax = bu.arrMax([maxmax, a, b])        // high) vini.
  } else {
    minmin = bu.arrMin([minmin, a, b])
    maxmax = bu.arrMax([maxmax, a, b])
  }
  if (gol.plotall && gol.tmin<=gol.tini && gol.tini<=gol.tmax
      && gol.tini in allvals) {      
    // At tini, leave room for all non-agg'd datapoints
    minmin = min(minmin, bu.arrMin(allvals[gol.tini].map(e => e[1])))
    maxmax = max(maxmax, bu.arrMax(allvals[gol.tini].map(e => e[1])))
  }
  if (gol.vmin == null && gol.vmax == null) {     // neither provided explicitly
    gol.vmin = minmin
    gol.vmax = maxmax
    if (gol.vmin == gol.vmax) {
      gol.vmin -= 1; gol.vmax += 1                // scooch away from each other
    } else if (gol.vmin > gol.vmax) {
      [gol.vmin, gol.vmax] = [gol.vmax, gol.vmin] // swap them
    }
  } else if (gol.vmin==null) gol.vmin = minmin < gol.vmax ? minmin : gol.vmax-1
  else if   (gol.vmax==null) gol.vmax = maxmax > gol.vmin ? maxmax : gol.vmin+1
}

// Stringified version of a graph matrix row
function showrow(row) {
  return JSON.stringify(row[0] === null ? row : 
                                        [bu.formatDate(row[0]), row[1], row[2]])
}

// Sanity check a row of the graph matrix; exactly one-out-of-three is null
function validrow(r) {
  if (!bu.listy(r) || r.length != 3) return false
  return    r[0]==null     && bu.nummy(r[1]) && bu.nummy(r[2])
         || bu.nummy(r[0]) && r[1]==null     && bu.nummy(r[2])
         || bu.nummy(r[0]) && bu.nummy(r[1]) && r[2]==null
}

// Convenience functions for error checking
const validyaw = (y) => y === -1 || y === 0 || y === 1               // yaw
const validead = (d) => bu.nummy(d) && (6-24)*3600 <= d&&d <= 6*3600 // deadline
const validate = (t) => bu.nummy(t) && 0 < t && t < bu.BDUSK         // tini etc
const validyax = (s) => bu.stringy(s) && s.length<80                 // yaxis
const torf     = (x) => typeof x === "boolean"      // True or False
const born     = (x) => torf(x) || x === null       // Boolean or Null
const norn     = (x) => bu.nummy(x) || x === null   // Numeric or Null
const torn     = (x) => validate(x) || x === null   // Timey or Null
const sorn     = (x) => bu.stringy(x) || x === null // String or Null

// Error-checking function and error message for each in-param
const pchex = {
quantum  : [bu.nummy,           "isn't numeric"],
timey    : [torf,               "isn't boolean"],
ppr      : [torf,               "isn't boolean"],
deadline : [validead,           "outside 6am earlybird and 6am nightowl"],
asof     : [validate,           "isn't a valid timestamp"],
tini     : [validate,           "isn't a valid timestamp"],
vini     : [bu.nummy,           "isn't numeric"],
road     : [bu.listy,           "(graph matrix) isn't a list"],
tfin     : [torn,               "isn't a valid timestamp or null"],
vfin     : [norn,               "isn't numeric or null"],
rfin     : [norn,               "isn't numeric or null"],
runits   : [v => v in bu.SECS,  "isn't a valid rate unit"],
gunits   : [bu.stringy,         "isn't a string"],
yaw      : [validyaw,           "isn't -1 or 1 or 0"],
dir      : [v => v==1 || v==-1, "isn't -1 or 1"],
pinkzone : [bu.listy,           "isn't a a list"],
tmin     : [torn,               "isn't a valid timestamp or null"],
tmax     : [torn,               "isn't a valid timestamp or null"],
vmin     : [norn,               "isn't numeric or null"],
vmax     : [norn,               "isn't numeric or null"],
kyoom    : [torf,               "isn't boolean"],
odom     : [torf,               "isn't boolean"],
monotone : [torf,               "isn't boolean"],
aggday   : [v => v in br.AGGR,  "isn't one of max, sum, last, mean, etc"],
plotall  : [torf,               "isn't boolean"],
steppy   : [torf,               "isn't boolean"],
rosy     : [torf,               "isn't boolean"],
movingav : [torf,               "isn't boolean"],
aura     : [torf,               "isn't boolean"],
hashtags : [torf,               "isn't boolean"],
yaxis    : [validyax,           "isn't a string of at most 79 chars"],
waterbuf : [sorn,               "isn't a string or null"],
waterbux : [bu.stringy,         "isn't a string"],
hidey    : [torf,               "isn't boolean"],
stathead : [torf,               "isn't boolean"],
yoog     : [bu.stringy,         "isn't a string"],
goal     : [norn,               "isn't numeric or null"],
rate     : [norn,               "isn't numeric or null"],
}

/** Sanity check the input parameters. Return non-empty string if it fails. */
function vetParams() {
  for (const p in pchex) {
    const chk = pchex[p][0]
    const msg = pchex[p][1]
    if (!chk(gol[p])) return `${p} = ${JSON.stringify(gol[p])}\\nERROR: ${msg}`
  }
  
  for (const row of gol.road)
    if (!validrow(row))
      return "Invalid graph matrix row: "+showrow(row)

  for (const row of gol.pinkzone)
    if (!validrow(row))
      return "Invalid pinkzone row: "+showrow(row)

  // At this point graph matrix (road) guaranteed to be a list of length-3 lists
  // (I guess we don't mind a redundant final graph matrix row)
  const mrd = gol.road.slice(1, gol.road.length-1)
  if (mrd.length !== bu.deldups(mrd).length) {
    let prev = mrd[0] // previous row
    for (const row of mrd) {
      if (bu.arrayEquals(row, prev))
        return "Graph matrix has duplicate row: "+showrow(row)
      prev = row
    }
  }
  if (gol.kyoom && gol.odom)
    return "The odometer setting doesn't make sense for an auto-summing goal!"
  if (gol.tmin > gol.asof)
    return "You can't set the graph bounds to be solely in the future!"

  return ""
}

// Generate razrroad for YBHP migration by shifting each segment by the lane
// width in the negative yaw direction, ie, towards the bad side of the road.
// This yields a razrroad that coincides with the critical edge of the old-style
// laney road. Sort of. At least the critical edge as drawn on the graph, which
// isn't the real critical edge since road width depended on the rate. See
// https://github.com/beeminder/road/issues/96#issuecomment-629482046 for the
// very gory details. #DIELANES
// We're holding on to this in case we want to convert any historical roads in
// archived goals. The current decision is to not do that. Rather, we just
// interpret the historical centerline as being the razor road. It's hard to
// improve on that and hardly matters anyway since it's only about historical
// roads but it's possible we could want to use the current rate as a proxy for
// lane width and shift historical roads towards the bad side by that amount,
// which is what this function does.
function genRazr() {
  const yaw = gol.yaw
  const t1 = seg => seg.sta[0]
  const t2 = seg => seg.end[0]
  const v1 = seg => seg.sta[1]
  const v2 = seg => seg.end[1]
  const offset = bu.conservaround(0 /* lane width or current rate */, 1e-14, 1)

  // Iterate over road segments, s, where segments go from
  // {t1,       v1      } to {t2,       v2      } or 
  // {s.sta[0], s.sta[1]} to {s.end[0], s.end[1]}
  gol.razrroad = roads.slice().map(s => {
    // Previous things we tried:
    // (1) lnf of the midpoint of the segment:     offset = lnf((t1(s)+t2(s))/2)
    // (2) min of lnf(t1) and lnf(t2):      offset = min(lnf(t1(s)), lnf(t2(s)))
    // (3) max of current lnw and amount needed to ensure not redyest:
    //     yest = gol.asof - SID
    //     bdelt = -yaw*(gol.dtf(yest) - br.rdf(roads, yest)) // bad delta
    //     offset = yest < gol.tini ? gol.lnw : max(gol.lnw, bdelt)
    // (4) just use current lnw for chrissakes
    return {
      sta:   [t1(s), v1(s) - yaw*offset],
      end:   [t2(s), v2(s) - yaw*offset],      
      slope: s.slope,
      auto:  s.auto,
    }
  })

  // Beebody style graph matrix is a list of end-of-segment values, and each
  // segment means "start where previous segment left off, and then connect that
  // to these new coordinates". But for the very first segment we draw, we need
  // to know where to start, so we add the tini/vini row, but that is kind of an
  // exception, because we don't draw that segment, we just use it to know where
  // to start the first segment. But the road structure that we create in
  // razrroad for bgraph to use, each segment has a start and an end. When we
  // map over that road struct to turn it into a graph matrix style data, we
  // need the initial dummy row to give us tini/vini, but we don't  need the
  // final dummy row.
  gol.razrmatr = gol.razrroad.slice(0,-1).map(s => {
    if (s.auto === 0) return [null,     s.end[1], s.slope*gol.siru]
    if (s.auto === 1) return [s.end[0], null,     s.slope*gol.siru]
    if (s.auto === 2) return [s.end[0], s.end[1], null   ]
    return "ERROR"
  })
}

/** Process goal parameters */
function procParams() {

  gol.dtf = br.stepify(data) // map timestamps to most recent datapoint value
  
  gol.road = br.fillroad(gol.road, gol)
  const rl = gol.road.length
  gol.tfin = gol.road[rl-1][0] // TODO: what if this isn't at a day boundary?
  gol.vfin = gol.road[rl-1][1]
  gol.rfin = gol.road[rl-1][2]
  // tfin, vfin, rfin are set in procRoad
  
  // Error checking to ensure the road rows are in chronological order
  const tlist = gol.road.map(e => e[0])
  if (gol.tini > tlist[0]) {
    return "Graph matrix error\\n(There are segments of your bright red line\\n"
      +"that are somehow dated before your goal's start date!)"
  } 
  // The above check is superfluous for now because fillroad() actually cleans
  // up the graph matrix by throwing away road rows that violate that. See the 
  // notes in the comments of fillroad() in broad.js.
  if (!bu.orderedq(tlist)) {
    return "Dial error\\n(Your goal date, goal "
      +(gol.kyoom?"total":"value")+", and rate are inconsistent!\\n"
      +"Is your rate positive when you meant negative?\\n"
      +"Or is your goal "+(gol.kyoom?"total":"value")+" such that the implied"
      +" goal date is in the past?)"
  }
 
  // rdf function is implemented in broad.js
  // rtf function is implemented in broad.js

  gol.stdflux = br.stdflux(roads, data.filter(d => d[0]>=gol.tini))
  
  flatline()

  const dl = data.length
  const enableFili = true
  const filiAura = true
  
  if (gol.movingav || (filiAura && gol.aura && enableFili)) {
    // Filter data and produce moving average
    if (!(dl <= 1 || data[dl-1][0]-data[0][0] <= 0)) { 

      if (enableFili && fili !== undefined) {
        // IIR filter design
        let iirCalc = new Fili.CalcCascades()
        let mavFilterCoeffs = iirCalc.lowpass({
          order: 1, // cascade 3 biquad filters (max: 12)
          characteristic: 'bessel',
          Fs: 1000, // sampling frequency
          Fc: 50, // cutoff frequency / center frequency for bandpass, bandstop, peak
          gain: 0, // gain for peak, lowshelf and highshelf
          preGain: false // adds one constant multiplication for highpass and lowpass
          // k = (1 + cos(omega)) * 0.5 / k = 1 with preGain == false
        })
        let mavFilter = new Fili.IirFilter(mavFilterCoeffs)

        // Generate daily samples for consistent filtering
        let a = data[0][0], b = data[dl-1][0]
        let newx = bu.linspace(a, b, 1+ceil((b-a)/(SID)))

        // Data is levelled out (by subtracting a linear function from
        // the start to the end) to begin and end at value 0 to
        // prevent erroneous filter behavior at the boundaries. This
        // is undone after filtering to restore the original offsets
        let dst = data[0][1], dend = data[dl-1][1]
        let tst = data[0][0], dsl = (dend - dst)/(data[dl-1][0] - tst)
        let unfilt = [0], ind = 0, newind = false
        let slope = (data[ind+1][1]-data[ind][1])/(data[ind+1][0]-data[ind][0])
        for (let i = 1; i < newx.length; i++) {
          if (newx[i] == data[ind+1][0]) {
            unfilt.push(data[ind+1][1]-dst-dsl*(newx[i]-tst))
            ind++
            if (ind == data.length-1) break
            slope = (data[ind+1][1]-data[ind][1])/(data[ind+1][0]-data[ind][0])
          } else {
            if (newx[i] > data[ind+1][0]) {
              ind++
              if (ind == data.length) break
              slope = (data[ind+1][1]-data[ind][1])/(data[ind+1][0]-data[ind][0])
            }
            unfilt.push(data[ind][1] + (newx[i]-data[ind][0])*slope
                        -dst-dsl*(newx[i]-tst))
          }
        }
        const padding = 50
        // Add padding to the end of the array to correct boundary errots
        for (let i = 0; i < padding; i++) unfilt.push(0)
        let mavdata = mavFilter.filtfilt(unfilt)
        // Remove padding elements
        mavdata.splice(-padding, padding)
        // Merge with timestamps and remove linear offset introduced
        // during preprocessing
        gol.filtpts
          = bu.zip([newx, mavdata.map(d=>d+dst)]).map(d=>[d[0], d[1]+dsl*(d[0]-tst)])

        if (filiAura) {
          // Calculate cutoff frequency based on the number of visible datapoints
          let visibledata = data.filter(d=>(d[0]>=gol.tmin))
          let cutoff = 50 - min(45,10*(visibledata.length/30))
          let auraFilterCoeffs = iirCalc.lowpass({
            order: 1, characteristic: 'bessel', Fs: 1000, Fc: cutoff,
            gain: 0, preGain: false
          })
          let auraFilter = new Fili.IirFilter(auraFilterCoeffs)
          let auradata = auraFilter.filtfilt(unfilt)
          // Remove padding elements
          auradata.splice(-padding+7, padding-7) // Leave the horizon intact (7 days)
          // Merge with timestamps and remove linear offset introduced
          // during preprocessing
          let tlast = newx[newx.length-1]
          for (let i = 1; i < 8; i++) newx.push(tlast+SID*i)
          gol.aurapts
            = bu.zip([newx, auradata.map(d=>d+dst)]).map(d=>[d[0], d[1]+dsl*(d[0]-tst)])
        }
        
      } else {
        // Create new vector for filtering datapoints
        const newx = griddle(data[0][0], data[dl-1][0],
                             (data[dl-1][0]-data[0][0])*4/SID)
        gol.filtpts = newx.map(d => [d, ema(data, d)])
      }
    } else gol.filtpts = []
  } else gol.filtpts = []

  gol.tcur  = dl === 0 ? gol.tini : data[dl-1][0]
  gol.vcur  = dl === 0 ? gol.vini : data[dl-1][1]
  gol.vprev = data[max(dl-2,0)][1] // default to vcur if < 2 datapts

  gol.safebuf = br.dtd(roads, gol, gol.tcur, gol.vcur)

  gol.tluz = min(gol.tcur + gol.safebuf*SID, gol.tfin + SID, bu.BDUSK)
  // let's kill the following so soon-to-end goals just have the tluz as tfin +
  // 1 day:
  if (gol.tluz > gol.tfin) gol.tluz = bu.BDUSK

  gol.delta = bu.chop(gol.vcur - br.rdf(roads, gol.tcur))
  gol.rah = br.rdf(roads, gol.tcur+bu.AKH)
  
  gol.dueby = br.dueby(roads, gol, 7)
  gol.safebump = br.lim(roads, gol, gol.safebuf)
  
  gol.rcur = br.rtf(roads, gol.tcur) * gol.siru
  gol.ravg = br.tvr(gol.tini, gol.vini, gol.tfin,gol.vfin, null) * gol.siru
  gol.cntdn = ceil((gol.tfin-gol.tcur)/SID)
  // The "lane" out-param for backward-compatibility:
  gol.lane = gol.yaw * (gol.safebuf - (gol.safebuf <= 1 ? 2 : 1))
  gol.color = (gol.safebuf < 1 ? "red"    :
               gol.safebuf < 2 ? "orange" :
               gol.safebuf < 3 ? "blue"   : "green")
  gol.loser = br.redyest(roads, gol, gol.tcur) // needs iso here; is that fine?
  gol.sadbrink = (gol.tcur-SID > gol.tini)
    && (br.dotcolor(roads, gol, gol.tcur-SID,
                    gol.dtf(gol.tcur-SID, gol.isolines))==bu.BHUE.REDDOT)
      
  setDefaultRange()
  return ""
}

/* BEGIN SAFESUM REFERENCE DUMP 

def platonic_type
  return "phat" if dir == -1 && yaw == -1
  return "moar" if dir ==  1 && yaw ==  1
  return "ween" if dir ==  1 && yaw == -1
  return "rash" if dir == -1 && yaw ==  1
  return "moar" # should never fall thru to this but some old goals have yaw==0
end

def is_moar?
  platonic_type == "moar"
end

def is_phat?
  platonic_type == "phat"
end

def is_ween?
  platonic_type == "ween"
end

def is_rash?
  platonic_type == "rash"
end

# Is this goal a WEEN or RASH (see platonic goal types in api docs)
def is_weeny?
  yaw * dir < 0
end

def is_autod?
  ii[:name].present?
end

def is_eep_day?
  if bb[:safebuf] && bb[:safebuf]-1 < 0
    return true
  elsif is_weeny? && !is_autod? && pessimistic
    if bb[:safebuf] && bb[:safebuf] < 1
      datapoints.on_date(nowstamp(self.deadline, tz).to_s(:ds)).none?
    end
  end
  return false
end

def baremin(show_seconds=false)
  if bb[:limsum].nil? || !bb[:error].blank?
    bb[:error]
  elsif bb[:limsum] == "n/a"
    bb[:limsum]
  else
    bmin = bb[:limsum].match(/([\d\.\-\+]+)/)[0]
    if self.timey
      prefix = bmin.to_f > 0 ? "+" : ""
      prefix + TimeUtils.hours_to_HHMM(bmin, 
        yaw > 0 ? "ceil" : "floor", show_seconds)
    elsif Integer(100*bmin.to_f) == 100*bmin.to_f
      "#{bmin}"
    else
      prefix = bmin.to_f > 0 ? "+" : ""
      if self.yaw > 0
        prefix + "#{((100*bmin.to_f).floor + 1).round/100.0}"
      elsif self.yaw < 0
        prefix + "#{((100*bmin.to_f).ceil - 1).round/100.0}"
      end
    end
  end
end

def bareminDelta(show_seconds=false)
  if !bb[:error].blank?
    return bb[:error]
  elsif bb[:delta].nil? || bb[:lnw].nil? || bb[:vcur].nil?
    return "Error"
  elsif bb[:safebump].nil?
    return baremin(show_seconds)
  end
  if yaw*dir < 1
    hardcap = (bb[:delta] + yaw*bb[:lnw])*yaw
    shns(hardcap)
  else
    shns(bb[:safebump] - bb[:vcur])
  end
end

def bareminAbs(show_seconds=false)
  if !bb[:error].blank?
    return bb[:error]
  elsif bb[:delta].nil? || bb[:lnw].nil? || bb[:vcur].nil?
    return "Error"
  elsif bb[:safebump].nil?
    return baremintotal(show_seconds)
  end
  if yaw*dir < 1
    critical_edge = bb[:vcur] - bb[:delta] - yaw*bb[:lnw]
    shn(critical_edge)
  else
    shn(bb[:safebump])
  end
end

def baremintotal(show_seconds=false)
  # As of Dec 2019 or earlier; deprecated, but still used for frozen/stale goals
  if bb[:limsum].nil? || !bb[:error].blank?
    bb[:error]
  elsif bb[:limsum] == "n/a"
    bb[:limsum]
  else
    bmintotal = 
     bb[:vcur] + bb[:limsum].match(/^[\d\.\+\-]+/)[0].gsub(/[^\d\.\-]/, "").to_f
    if self.timey
      TimeUtils.hours_to_HHMM(bmintotal, 
        yaw > 0 ? "ceil" : "floor", show_seconds)
    elsif bmintotal.floor == bmintotal
      "#{bmintotal.to_i}"
    elsif Integer(100*bmintotal.to_f) == 100*bmintotal.to_f
      "#{bmintotal}"
    elsif self.yaw > 0
      "#{((100*bmintotal.to_f).floor + 1).round/100.0}"
    elsif self.yaw < 0
      "#{((100*bmintotal.to_f).ceil - 1).round/100.0}"
    end
  end
end

# input variables: yaw, dir, eep

return "goal is not currently active" if is_frozen?

due_datetime = self.countdown.in_time_zone(self.tz) + 1

if due_datetime.strftime('%M') == "00"
  short_due_str = due_datetime.strftime('%-l%P') # the - removes leading padding
else
  short_due_str = due_datetime.strftime('%-l:%M%P')
end

# if gunits is not defined, we don't want two spaces
gunits = gunits.blank? ? " " : " #{gunits} "

if is_eep_day? && is_moar?
  if aggday == "sum" // aka safesum hides total
    # MOAR, eep, delta-only -> +1 pushup due by 12am
    return "#{bareminDelta}#{gunits}due by #{short_due_str}"
  else
    # MOAR, eep, not delta-only -> +1 pushups (12345) due by 12am
    return "#{bareminDelta}#{gunits}(#{bareminAbs}) due by #{short_due_str}"
  end
elsif is_eep_day? && is_phat?
  if aggday == "sum" // aka safesum hides total
    # PHAT, eep, delta-only -> hard cap -2 pounds by 12am
    return "hard cap #{bareminDelta}#{gunits}by #{short_due_str}"
  else
    # PHAT, eep, not delta-only -> hard cap -2 pounds (150) by 12am
    return 
      "hard cap #{bareminDelta}#{gunits}(#{bareminAbs}) by #{short_due_str}"
  end
elsif !is_eep_day? && is_phat?
  if bb[:dueby].present? and bb[:dueby][0].present? and bb[:dueby][0].length > 2
    deltahardcap = shns(bb[:dueby][0][1])
    abshardcap = shn(bb[:dueby][0][2])
  else
    deltahardcap = bb[:error].present? ? bb[:error] : '[ERROR]'
    abshardcap = ''
  end

  if aggday == "sum" // aka safesum hides total
    # PHAT, not eep, delta-only -> hard cap +2 pounds today˚
    return "hard cap #{deltahardcap}#{gunits}today"
  else
    # PHAT, not eep, not delta-only -> hard cap +2 pounds (150) today
    return "hard cap #{deltahardcap}#{gunits}(#{abshardcap}) today"
  end
elsif !is_eep_day? && is_moar?
  #MOAR, not eep -> safe for X days
  safe_days_str = "#{bb[:safebuf]} day"
  if bb[:safebuf] > 1
    safe_days_str += "s"
  end unless bb[:safebuf].nil?
  return "safe for #{safe_days_str}"
elsif is_eep_day? && (is_ween? || is_rash?)
  if aggday == "sum" // aka safesum hides total
    #RASH/WEEN, eep, delta-only -> hard cap +3 servings by 12am
    return "hard cap #{bareminDelta}#{gunits}by #{short_due_str}"
  else
    #RASH/WEEN, eep, not delta-only -> hard cap +4 cigarettes (12354) by 12am
    return 
      "hard cap #{bareminDelta}#{gunits}(#{bareminAbs}) by #{short_due_str}"
  end
elsif !is_eep_day? && (is_ween? || is_rash?)
  if aggday == "sum" // aka safesum hides total
    #RASH/WEEN, not eep, delta-only -> hard cap +3 servings today
    return "hard cap #{bareminDelta}#{gunits}today"
  else
    #RASH/WEEN, not eep, not delta-only -> hard cap +4 cigarettes (12354) today
    return "hard cap #{bareminDelta}#{gunits}(#{bareminAbs}) today"
  end
end

END SAFESUM REFERENCE DUMP */

function safesumSet(rd, gol) {
  const y = gol.yaw, d = gol.dir, dlt = gol.delta, q = gol.quantum
  const c = gol.safebuf // countdown to derailment, in days
  const cd = bu.splur(c, "day")

  if (y*d<0)      gol.safesum = "unknown days of safety buffer"
  else if (c>999) gol.safesum = "more than 999 days of safety buffer"
  else            gol.safesum = "~"+cd+" of safety buffer"
}

function sumSet(rd, gol) {
  const y = gol.yaw, d = gol.dir, 
        l = gol.lane, dlt = gol.delta, 
        q = gol.quantum

  const MOAR = (y>0 && d>0), 
        PHAT = (y<0 && d<0),
        WEEN = (y<0 && d>0), 
        RASH = (y>0 && d<0)

  const shn  = ((x, e=y, t=4, d=2) => q===null ? bu.shn(x, t, d, e) : // TODO
                                                 bu.conservaround(x, q, e))
  const shns = ((x, e=y, t=4, d=2) => (x>=0 ? "+" : "") + shn(x, e, t, d))


  if (gol.error != "") {
    gol.statsum = " error:    "+gol.error+"\\n"
    return
  }
  const rz = (bu.zip(gol.road))[2]
  let minr = bu.arrMin(rz)
  let maxr = bu.arrMax(rz)
  if (abs(minr) > abs(maxr)) { const tmp = minr; minr = maxr; maxr = tmp }
  const smin = bu.shn(minr,      4,2)
  const smax = bu.shn(maxr,      4,2)
  const savg = bu.shn(gol.ravg, 4,2)
  const scur = bu.shn(gol.rcur, 4,2)
  gol.ratesum = 
    (minr === maxr ? smin : "between "+smin+" and "+smax) +
    " per " + bu.UNAM[gol.runits] + 
    (minr !== maxr ? " (current: " + scur + ", average: " + savg + ")" : "")

  // What we actually want is timesum and togosum (aka, progtsum & progvsum) 
  // which will be displayed with labels TO GO and TIME LEFT in the stats box
  // and will have both the absolute amounts remaining as well as the 
  // percents done as calculated here.
  const at = bu.daysnap(gol.tini)
  const xt = bu.daysnap(gol.tcur)
  const bt = bu.daysnap(gol.tfin)
  const av = gol.vini
  const xv = gol.vcur
  const bv = gol.vfin
  let pt, pv // percent done by time, percent done by value
  pt = at === bt ? '??' : bu.shn(bu.rescale(xt, at,bt, 0,100), 1,1)
  if (av === bv)
    pv = xv < av && gol.yaw > 0 ||
         xv > av && gol.yaw < 0    ? '00' : '100'
  else if (abs(av-bv) < 1e-7)
    pv = xv <  (av+bv)/2 && gol.yaw > 0 ||
         xv >  (av+bv)/2 && gol.yaw < 0    ? '~0' : '~100'
  else pv = bu.shn(bu.rescale(gol.vcur, gol.vini,gol.vfin, 0,100), 1,1)

  if (pt == pv) gol.progsum = pt+"% done"
  else          gol.progsum = pt+"% done by time -- "+pv+"% by value"

  let x, ybrStr
  if (gol.cntdn < 7) {
    x = sign(gol.rfin) * (gol.vfin - gol.vcur)
    ybrStr = "w/ "+shn(x,0,2,1)+" to go to goal"
  } else {
    x = br.rdf(roads, gol.tcur+gol.siru) - br.rdf(roads, gol.tcur)
    ybrStr = "@ "+(x>=0 ? "+" : "")+bu.shn(x, 2, 1, 0)
                           +" / "+bu.UNAM[gol.runits]
  }

  const ugprefix = false // debug mode: prefix yoog to graph title
  gol.graphsum = 
      (gol.asof !== gol.tcur ? "["+bu.shd(gol.asof)+"] " : "")
    + (ugprefix ? gol.yoog : "")
    + shn(gol.vcur,0,3,1)+" on "+bu.shd(gol.tcur)+" ("
    + bu.splur(gol.numpts, "datapoint")+" in "
    + bu.splur(1+floor((gol.tcur-gol.tini)/SID),"day")+") "
    + "targeting "+shn(gol.vfin,0,3,1)+" on "+bu.shd(gol.tfin)+" ("
    + bu.splur(gol.cntdn, "more day")+") "+ybrStr

  gol.deltasum = shn(abs(dlt),0) + " " + gol.gunits
    + (dlt<0 ? " below" : " above")+" the bright line"

  const c = gol.safebuf // countdown to derailment, in days
  const cd = bu.splur(c, "day")
  const lim  = br.lim (roads, gol, MOAR || PHAT ? c : 0)
  const limd = br.limd(roads, gol, MOAR || PHAT ? c : 0)
  if (gol.kyoom) {
    if (MOAR) gol.limsum = shns(limd)+" in "+cd
    if (PHAT) gol.limsum = shns(limd)+" in "+cd
    if (WEEN) gol.limsum = shns(limd)+" today" 
    if (RASH) gol.limsum = shns(limd)+" today"
  } else {
    if (MOAR) gol.limsum= shns(limd)+" in "+cd+" ("+shn(lim)+")"
    if (PHAT) gol.limsum= shns(limd)+" in "+cd+" ("+shn(lim)+")"
    if (WEEN) gol.limsum= shns(limd)+" today ("    +shn(lim)+")"    
    if (RASH) gol.limsum= shns(limd)+" today ("    +shn(lim)+")"
  }

  gol.titlesum = 
    bu.toTitleCase(gol.color) + ": bmndr.com/"+gol.yoog+" is safe for ~"+cd
    + (c===0 ? " (beemergency!)" : "")
  gol.headsum = gol.titlesum

  gol.statsum =
    " progress: "+bu.shd(gol.tini)+"  "
    +(data == null ? "?" : bu.shn(gol.vini, 4, 2, 0))+"\\n"
    +"           "+bu.shd(gol.tcur)+"  "+bu.shn(gol.vcur, 4, 2, 0)
    +"   ["+gol.progsum+"]\\n"
    +"           "+bu.shd(gol.tfin)+"  "+bu.shn(gol.vfin, 4, 2, 0)+"\\n"
    +" rate:     "+gol.ratesum+"\\n"
    +" lane:     " +((abs(l) == 666)?"n/a":l)+"\\n"
    +" safebuf:  "+gol.safebuf+"\\n"
    +" delta:    "+gol.deltasum+"\\n"
    +" "
  if      (y==0) gol.statsum += "limit:    "
  else if (y<0)  gol.statsum += "hard cap: "
  else           gol.statsum += "bare min: "
  gol.statsum += gol.limsum+"\\n"
  //gol.statsum = encodeURI(gol.statsum) // TODO
  safesumSet(rd, gol)
}

// Fetch value with key n from hash p, defaulting to d -- NOT USED 
/*
function getNumParam (p, n, d) { return n in p ? Number(p[n]) : d }
function getBoolParam(p, n, d) { return n in p ? p[n]         : d }
function getStrParam (p, n, d) { return n in p ? p[n]         : d }
*/

/** Initiates reprocessing of a newly changed road, recomputing
 * associated goal stats and internal details.*/
this.reloadRoad = function() {
  //console.debug("id="+curid+", reloadRoad()")
  const error = procParams()

  if (error != "") return error
    
  sumSet(roads, gol)

  // TODO: This seems to compute these entities based on old data, particularly
  // when this function is called from bgraph as a result of an edited road.
  gol.fullroad = gol.road.slice()
  gol.fullroad.unshift( [gol.tini, gol.vini, 0, 0] )
  if (gol.error == "") {
    gol.pinkzone = [[gol.asof, br.rdf(roads, gol.asof), 0]]
    gol.road.forEach(
      function(r) {
        if (r[0] > gol.asof && r[0] < gol.asof+bu.AKH) {
          gol.pinkzone.push([r[0], r[1], null])
        }
      }
    )
    gol.pinkzone.push([gol.asof+bu.AKH, br.rdf(roads, gol.asof+bu.AKH),
                        null])
    gol.pinkzone = br.fillroadall(gol.pinkzone, gol)
  }
    
  // Generate the aura function now that the flatlined datapoint's also computed
  if (gol.aura) {
    if (gol.aurapts === undefined) {
      const adata = data.filter(e => e[0]>=gol.tmin)
      const fdata = br.gapFill(adata)
      gol.auraf = br.smooth(fdata)
    } else {
      gol.auraf = function(x) {
        let ind = bu.searchLow(gol.aurapts, d=>(d[0]-x))
        if (ind == -1) return gol.aurapts[0][1]
        else if (ind == gol.aurapts.length-1) return gol.aurapts[gol.aurapts.length-1][1]
        else {
          let pt1 = gol.aurapts[ind], pt2 = gol.aurapts[ind+1]
          return pt1[1] + (x-pt1[0]) * (pt2[1]-pt1[1])/(pt2[0]-pt1[0])
        }
      }
    }
  } else gol.auraf = (e => 0)

  gol.dtdarray = br.dtdarray( roads, gol )
  
  gol.isolines = []
  for (let i = 0; i < 4; i++)
    gol.isolines[i] = br.isoline(roads, gol.dtdarray, gol, i)
  
  return ""
}

let stats = {}

/** Process goal details */
function genStats(p, d, tm=null) {
  //console.debug("genStats: id="+curid+", "+p.yoog)

  try {
    if (tm == null) tm = moment.utc().unix() // Start the clock immediately!
    legacyIn(p)                              // Which is kind of silly because
    initGlobals()                            // legacyIn and initGlobals take no
    gol.proctm = tm                         // time so could just get time here
    // stampIn() returns the data array in the following format
    // [t, v, c, index, v(original)] 
    data = stampIn(p, d)
    
    // make sure all supplied params are recognized
    const lup = [] // list of unknown parameters
    for (const k in p) {
      if (k in p) {
        if (!(k in pin) && !pig.includes(k)) lup.push(`${k}=${p[k]}`)
        else gol[k] = p[k]
      }
    }
    if (lup.length > 0) gol.error += 
      `Unknown param${lup.length===1 ? "" : "s"}: ${lup.join(', ')}`

    // Process & extract various params that are independent of road & data
    // maybe just default to aggday=last; no such thing as aggday=null
    if (!('aggday' in p)) p.aggday = gol.kyoom ? "sum" : "last"
    
    gol.siru = bu.SECS[gol.runits]
    gol.horizon = gol.asof+bu.AKH-SID // draw the akrasia horizon 6 days out
    // Save initial waterbuf value for comparison in bgraph.js because we don't
    // want to keep recomputing it there as the red line is edited 
    gol.waterbuf0 = gol.waterbuf
    
    // Append final segment to the road array. These values will be re-extracted
    // after filling in road in procParams.
    if (bu.listy(gol.road)) gol.road.push([gol.tfin, gol.vfin, gol.rfin])
    if (gol.error == "") gol.error = vetParams()
    if (gol.error == "") gol.error = procData()
    
    // Extract road info into our internal format consisting of road segments:
    // [ [startt, startv], [endt, endv], slope, autofield ]
    if (gol.error == "") gol.error = procRoad(p.road)
    if (gol.error == "") gol.error = self.reloadRoad() // does procParams here

    computeRosy()
      
  } finally {
    // Generate beebrain stats (use getStats tp retrieve)
    stats = Object.assign({}, pout)
    for (const prop in stats) stats[prop] = gol[prop]
    stampOut(stats)
    legacyOut(stats)
  }
}

/**Returns an object with pre-computed goal statistics, summaries and other
   details. */
this.getStats = function() { return bu.deepcopy(stats) }

/**Set a new road object for Beebrain. Should be followed by a call to 
   {@link beebrain#reloadRoad reloadRoad()} to perform a recomputation of goal
   stats. Used by the road editor implemented by the {@link bgraph} module.*/
this.setRoadObj = function(newroad) {
  if (newroad.length == 0) {
    console.log("id="+curid+", setRoadObj(), null redline!")
    return
  }
  roads = newroad
  self.roads = roads

  // Update the internal road object in bb format so procParams can proceed
  gol.road = []
  for (let i = 1; i < roads.length; i++)
    gol.road.push([roads[i].sta[0], roads[i].sta[1], roads[i].slope])
  self.gol = gol

  self.reloadRoad()
}
  
genStats( bbin.params, bbin.data )
gol.graphurl = bu.BBURL
gol.thumburl = bu.BBURL
  
// -----------------------------------------------------------------------------
// -------------------------- BEEBRAIN OBJECT EXPORTS --------------------------

/** beebrain object ID for the current instance */
this.id = curid
  
// Static members for outside access
this.DPTYPE = DPTYPE

/** Holds the current array of road segments. The
format for this object is an array of linear segments, each of
which is an object with the following format: `{sta: [t, v], end:
[t, v], slope: r, auto: autoparam}`, where `r` is expressed in
Hertz (1/s), and `autoparam` is one of the enumerated values in
{@link module:broad.RP broad.RP}, indicating which entry will be
auto-computed. Note that the end point for one segment is required
to be identical to the starting point for the next
segment.  */
this.roads = roads
/** Holds current goal's information */
this.gol = gol
/** Holds current goal's aggregated datapoints */
this.data = data
/** Holds current goal's preprocessed rosy datapoints */
this.rosydata = rosydata
/** Holds all of current goal's datapoints */
this.alldata = alldata
/** Holds datapoint values associated with each day */
this.allvals = allvals
/** Holds all datapoints into the future */
this.fuda = fuda
/** Holds the flatlined datapoint */
this.flad = flad
/** Holds an array of odometer resets */
this.oresets = oresets
/** Holds an array of derailments */
this.derails = derails

this.hollow = hollow
this.hashtags = hashtags

} // END beebrain object constructor -------------------------------------------

return beebrain

})) // END MAIN ----------------------------------------------------------------

/**
 * Beebrain graph generation and red line editing provided as a UMD module.
 * Provides a {@link bgraph} class, which can be used to construct independent
 * graph generating objects each with their own internal state, possibly linked
 * to particular div elements on the DOM.<br/>
 * <br/>Copyright 2017-2021 Uluc Saranli and Daniel Reeves
 @module bgraph
 @requires d3
 @requires moment
 @requires butil
 @requires broad
 @requires beebrain
 */

;((function (root, factory) { // BEGIN PREAMBLE --------------------------------

'use strict'

if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  //console.log("bgraph: Using AMD module definition")
  define(['d3', 'moment', 'butil', 'broad', 'beebrain'], factory)
} else if (typeof module === 'object' && module.exports) {
  // Node. Does not work with strict CommonJS, but only CommonJS-like
  // environments that support module.exports, like Node.
  //console.log("bgraph: Using CommonJS module.exports")
  module.exports = factory(require('d3'), 
                           require('./moment'), 
                           require('./butil'), 
                           require('./broad'), 
                           require('./beebrain'))
} else {
  //console.log("bgraph: Using Browser globals")
  root.bgraph    = factory(root.d3, 
                           root.moment, 
                           root.butil, 
                           root.broad, 
                           root.beebrain)
}

})(this, function (d3, moment, bu, br, bb) { // END PREAMBLE -- BEGIN MAIN -----

'use strict'

const nosteppy = false
  
// -----------------------------------------------------------------------------
// --------------------------- CONVENIENCE CONSTANTS ---------------------------

const max   = Math.max
const min   = Math.min
const abs   = Math.abs
const floor = Math.floor
const ceil  = Math.ceil
const round = Math.round

const DIY = 365.25
const SID = 86400

// -----------------------------------------------------------------------------
// ------------------------------ FACTORY GLOBALS ------------------------------

/** Global counter to generate unique IDs for multiple bgraph instances. */
let gid = 1

/** Default settings */
let defaults = {
  /** Generates an empty graph and JSON */
  noGraph:      false, 
  /** Binds the graph to a div element */
  divGraph:     null,
  /** Binds the road table to a div element */
  divTable:     null,    
  /** Binds the datapoint table to a div element */
  divPoints:    null,    
  /** Binds the dueby table to a div element */
  divDueby:    null,    
  /** Binds the data table to a div element */
  divData:    null,    
  /** Binds the goal JSON output to a div element */
  divJSON:      null,    
  /** Size of the SVG element to hold the graph */
  svgSize:      { width: 700, height: 450 },
  /** Boundaries of the SVG group to hold the focus graph */
  focusRect:    { x:0, y:0, width:700, height: 370 },
  /** Initial padding within the focus graph. */
  focusPad:     { left:25, right:5, top:25, bottom:30 },
  /** Boundaries of the SVG group to hold the context graph */
  ctxRect:      { x:0, y:370, width:700, height: 80 },
  /** Initial padding within the context graph. */
  ctxPad:       { left:25, right:5, top:0, bottom:30 },
  /** Height of the graph matrix table. Choose 0 for unspecified */
  tableHeight:  387,
  
  /** Visual parameters for the zoom in/out buttons. "factor" 
      indicates how much to zoom in/out per click. */
  zoomButton:   { size: 40, opacity: 0.6, factor: 1.5 },
  /** Size of the bullseye image in the focus and context graphs */ 
  bullsEye:     { size: 40, ctxsize: 20 },
  /** Visual parameters for draggable road dots */ 
  roadDot:      { size: 5, ctxsize: 3, border: 1.5, ctxborder: 1 },
  /** Visual parameters for draggable road knots and removal buttons */ 
  roadKnot:     { width: 3, rmbtnscale: 0.6 },
  /** Visual parameters for draggable road lines */ 
  roadLine:     { width: 3, ctxwidth: 2 },
  /** Visual parameters for fixed lines for the original road */ 
  oldRoadLine:  { width: 3, ctxwidth: 2, dash: 32, ctxdash: 16 },
  /** Visual parameters for data points (past, flatlined and hollow) */ 
  dataPoint:    { size: 5, fsize: 5, hsize: 2.5, border:1 }, 
  /** Visual parameters for the akrasia horizon */ 
  horizon:      { width: 2, ctxwidth: 1, dash: 8, ctxdash: 6, 
                  font: 10, ctxfont: 9 },
  /** Visual parameters for vertical line for asof */ 
  today:        { width: 2, ctxwidth: 1, font: 12, ctxfont: 9 },
  /** Parameters for d3 axes */
  axis:         {font: 11},
  /** Visual parameters for watermarks */
  watermark:    { height:170, fntsize:150, color:"#000000" }, // was #f0f0f0
  guidelines:   { width:2, weekwidth:4 },
  maxfluxline:  4, // width
  stdfluxline:  2, // width
  razrline:     3, // trying thicker bright red line: 2 -> 4 (see also mobile)
  /** Visual parameters for text boxes shown during dragging */ 
  textBox:      { margin: 3 },
  /** Visual parameters for odometer resets */ 
  odomReset:    { width: 0.5, dash: 8 },
  
  roadLineCol:  { valid: "black",    invalid:"#ca1212",  selected:"yellow" },
  roadDotCol:   { fixed: "darkgray", editable:"#c2c2c2", selected: "yellow" },
  roadKnotCol:  { dflt: "#c2c2c2", selected: "yellow",
                  rmbtn: "black", rmbtnsel: "red" },
  textBoxCol:   { bg: "#ffffff", stroke:"#d0d0d0" },
  roadTableCol: { bg:"#ffffff", bgHighlight: "#fffb55", 
                  text:"#000000", textDisabled: "#aaaaaa",
                  bgDisabled:"#f2f2f2"},
  dataPointCol: { future: "#909090", stroke: "#eeeeee" },
  halfPlaneCol: { fill: "#ffffe8" },
  pastBoxCol:   { fill: "#f8f8f8", opacity:0.5 },
  odomResetCol: { dflt: "#c2c2c2" }, 
                
  /** Strips the graph of all details except what is needed for svg output */
  headless:     false,
  /** Enables zooming by scrollwheel. When disabled, only the context graph and
      the zoom buttons will allow zooming. */
  scrollZoom:   true,
  /** Enables zooming with buttons */
  buttonZoom:   true,
  /** Enables the road editor. When disabled, the generated graph mirrors
      Beebrain output as closely as possible. */
  roadEditor:   false,
  /** Enables the display of the context graph within the SVG */
  showContext:  false,
  /** Enables showing a dashed rectangle in the context graph visualizing the
      current graph limits on the y-axis */
  showFocusRect: false,
  /** Enables displaying datapoints on the graph */ 
  showData:     true,
  /** When datapoint display is enabled, indicates the number of days before
      asof to show data for. This can be used to speed up display refresh for
      large goals. Use -1 to display all datapoints. */ 
  maxDataDays:  -1,
  /** Indicates how many days beyond asof should be included in the fully
      zoomed out graph. This is useful for when the goal date is too far beyond
      asof, making the context graph somewhat useless in the UI. */
  maxFutureDays: 365,
  /** Indicates whether slopes for segments beyond the currently dragged
      element should be kept constant during editing */
  keepSlopes:   true,
  /** Indicates whether guidelines should be shown in the interactive editor */
  showGuidelines: true,
  /** Indicates whether intervals between the knots for segments beyond the
      currently dragged element should be kept constant during editing */
  keepIntervals: false,
  /** Indicates whether the graph matrix table should be shown with the earliest
      rows first (normal) or most recent rows first (reversed) */ 
  reverseTable: false,
  /** Indicates whether the auto-scrolling feature for the graph matrix table
      should be enabled such that when the mouse moves over knots, dots, or road
      elements, the corresponding table row is scrolled to be visible in the
      table. This is particularly useful when tableHeight is explicitly
      specified and is nonzero. */ 
  tableAutoScroll: true,
  /** Chooses whether the graph matrix table should be dynamically updated
      during the dragging of road knots, dots, and segments. Enabling this may
      induce some lagginess, particularly on Firefox due to more components
      being updated during dragging. */
  tableUpdateOnDrag: false,
  /** Chooses whether the dueby table should be dynamically updated
      during the dragging of road knots, dots, and segments. */
  duebyUpdateOnDrag: true,
  /** Chooses whether the graph matrix table should include checkboxes for
      choosing the field to be automatically computed */
  tableCheckboxes: true,
  /** Callback function that gets invoked when the road is edited by the user.
      Various interface functions can then be used to retrieve the new road
      state. This is also useful to update the state of undo/redo and submit
      buttons based on how many edits have been done on the original road. */
  onRoadChange: null,
  /** Callback function that gets invoked when a datapoint is edited
      or deleted.  onDataEdit(id, data) indicates that the datapoint
      with the given id is edited with the new content "data =
      [daystamp, value, cmt]" or deleted if data=null */
  onDataEdit: null,
  /** Number of entries visible on the data table */
  dataTableSize: 11,
  dataAutoScroll: true,
  /** Callback function that gets invoked when an error is encountered in
      loading, processing, drawing, or editing the road */
  onError:      null,
}

/** This object defines default options for mobile browsers, where larger dots,
  knots, and lines are necessary to make editing through dragging feasible. */
const mobiledefaults = {
  svgSize:     { width: 700, height: 530 },
  focusRect:   { x:0, y:0, width: 700, height: 400 },
  focusPad:    { left: 25, right: 10, top: 35, bottom: 30 },
  ctxRect:     { x: 0, y: 400, width: 700, height: 80 },
  ctxPad:      { left: 25, right: 10, top: 0, bottom: 30 },
  tableHeight: 540, // Choose 0 for unspecified

  zoomButton:  { size: 50, opacity: 0.7, factor: 1.5 },
  bullsEye:    { size: 40, ctxsize: 20 },
  roadDot:     { size: 10, ctxsize: 4, border: 1.5, ctxborder: 1 },
  roadKnot:    { width: 7, rmbtnscale: 0.9 },
  roadLine:    { width: 7, ctxwidth: 2 },
  oldRoadLine: { width: 3, ctxwidth: 1, dash: 32, ctxdash: 16 },
  dataPoint:   { size: 4, fsize: 6 }, 
  horizon:     { width: 2, ctxwidth: 1, dash: 8, ctxdash: 8, 
                 font: 14, ctxfont: 10 },
  today:       { width: 2, ctxwidth: 1, font: 16, ctxfont: 10 },
  watermark:   { height: 150, fntsize: 100, color: "#000000" }, // was #f0f0f0
  guidelines:  { width: 2, weekwidth: 4 },
  maxfluxline: 4, // width
  stdfluxline: 2, // width
  razrline:    3, // trying thicker bright red line: 2 -> 4 (also for desktop)
  textBox:     { margin: 3 },
}

/** Style text embedded in the SVG object for proper saving of the SVG */
const SVGStyle = 
  ".svg{shape-rendering:crispEdges}" 
+ ".axis path,.axis line{fill:none;stroke:black;shape-rendering:crispEdges}"
+ ".axis .minor line{stroke:#777;stroke-dasharray:0,2,4,3}"
+ ".grid line"
+ "{fill:none;stroke:#dddddd;stroke-width:1px;shape-rendering:crispEdges}"
+ ".aura{fill-opacity:0.3;stroke-opacity:0.3;}"
+ ".aurapast{fill-opacity:0.15;stroke-opacity:0.3}"
+ ".grid .minor line{stroke:none}"
+ ".axis text{font-family:sans-serif;font-size:11px;}"
+ ".axislabel{font-family:sans-serif;font-size:11px;text-anchor:middle}"
+ "circle.dots{stroke:black}"
+ "line.roads{stroke:black}"
+ ".pasttext,.ctxtodaytext,.ctxhortext,.horizontext,.hashtag"
+ "{text-anchor:middle;font-family:sans-serif}"
+ ".waterbuf,.waterbux{opacity:0.05882353;" //stroke:#dddddd;stroke-width:1;"
+ "text-anchor:middle;font-family:Dejavu Sans,sans-serif}"
+ ".loading{text-anchor:middle;font-family:Dejavu Sans,sans-serif}"
+ ".zoomarea{fill:none}"
+ "circle.ap{stroke:none}"
+ "circle.rd{stroke:none;pointer-events:none;fill:"+bu.BHUE.ROSE+"}"
+ "circle.std{stroke:none;pointer-events:none;fill:"+(nosteppy?"#c0c0c0":bu.BHUE.PURP)+"}"
+ "circle.hp{stroke:none;fill:"+bu.BHUE.WITE+"}"
+ ".dp.gra,.ap.gra{fill:"+bu.BHUE.GRADOT+"}"
+ ".dp.grn,.ap.grn{fill:"+bu.BHUE.GRNDOT+"}"
+ ".dp.blu,.ap.blu{fill:"+bu.BHUE.BLUDOT+"}"
+ ".dp.orn,.ap.orn{fill:"+bu.BHUE.ORNDOT+"}"
+ ".dp.red,.ap.red{fill:"+bu.BHUE.REDDOT+"}"
+ ".dp.blk,.ap.blk{fill:"+bu.BHUE.BLCK+"}"
+ ".dp.fuda,.ap.fuda{fill-opacity:0.3}"
+ ".guides{pointer-events:none;fill:none;stroke:"+bu.BHUE.LYEL+"}"
+ ".ybhp{pointer-events:none}"
+ ".rosy{fill:none;stroke:"+bu.BHUE.ROSE+";pointer-events:none}"
+ ".steppy{fill:none;stroke:"+(nosteppy?"#c0c0c0":bu.BHUE.PURP)+";pointer-events:none}"
+ ".steppyppr{fill:none;stroke-opacity:0.8;stroke:"+bu.BHUE.LPURP+";pointer-events:none}"
+ ".derails{fill:"+bu.BHUE.REDDOT+";pointer-events:none}"
+ ".overlay .textbox{fill:#ffffcc;fill-opacity:0.5;stroke:black;"
+ "stroke-width:1;pointer-events:none;rx:5;ry:5}"

/** Fraction of plot range that the axes extend beyond */
const PRAF = 0.015

/** Seconds to milliseconds (Javascript unixtime is the latter) */
const SMS = 1000 


/** Enum object to identify error types */
const ErrType = { NOBBFILE: 0, BADBBFILE: 1, BBERROR: 2 }

/** Enum object to identify error types */
const ErrMsgs = [ "Could not find goal (.bb) file.", 
                  "Bad .bb file.", 
                  "Beeminder error" ]

/** This atrocity attempts to determine whether the page was loaded from a 
    mobile device. It might be from 2019 and in want of updating. */
const onMobileOrTablet = () => {
  if (typeof navigator == 'undefined' && typeof window == 'undefined') 
    return false
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true})(navigator.userAgent||navigator.vendor||window.opera)
  return check
}

/** Configure functionality (private) */
let config = (obj, options) => {
  if (!obj.opts) obj.opts = bu.extendo({}, defaults, true)
  
  if (onMobileOrTablet()) bu.extendo(obj.opts, mobiledefaults)
  
  let opts = bu.extendo(obj.opts, options, true)
  
  opts.divGraph = opts.divGraph && opts.divGraph.nodeName ? opts.divGraph : null
  
  if (opts.headless) {                        // Override options for svg output
    opts.divTable      = null
    opts.divPoints     = null
    opts.divDueby      = null
    opts.divData       = null
    opts.scrollZoom    = false
    opts.roadEditor    = false
    opts.showContext   = false
    opts.showFocusRect = false
  } else {
    opts.divTable = 
      opts.divTable && opts.divTable.nodeName ? opts.divTable : null
    opts.divPoints = 
      opts.divPoints && opts.divPoints.nodeName ? opts.divPoints : null
  }
  
  return opts
}

// -----------------------------------------------------------------------------
// ---------------------------- BGRAPH CONSTRUCTOR -----------------------------

/** @typedef BGraphOptions
    @global
    @type {object}
    @property {boolean} noGraph Generates an empty graph and JSON if true
    @property {Boolean} headless Strips the graph of all details except what is needed for svg output.
    @property {Boolean} roadEditor Enables the road editor. When disabled, the generated graph mirrors beebrain output as closely as possible.
    
    @property {object}  divJSON  Binds the goal JSON output to a div element

    @property {object}  divGraph Binds the graph to a div element
    @property {object}  svgSize  Size of the SVG element to hold the graph e.g. { width: 700, height: 450 }
    @property {object}  focusRect Boundaries of the SVG group to hold the focus graph e.g. { x:0, y:0, width:700, height: 370 }
    @property {object} focusPad Initial padding within the focus graph e.g. { left:25, right:5, top:25, bottom:30 }
    @property {object} ctxRect Boundaries of the SVG group to hold the context graph e.g. { x:0, y:370, width:700, height: 80 }
    @property {object} ctxPad Initial padding within the context graph e.g. { left:25, right:5, top:0, bottom:30 }
    @property {Boolean} scrollZoom Enables zooming by scrollwheel. When disabled, only the context graph and the zoom buttons will allow zooming.
    @property {Boolean} showContext Enables the display of the context graph within the SVG
    @property {Boolean} showFocusRect Enables showing a dashed rectange in the context graph visualizing the current graph limits on the y-axis
  
    @property {Boolean} keepSlopes Indicates whether slopes for segments beyond the currently dragged element should be kept constant during editing.
    @property {Boolean} keepIntervals Indicates whether intervals between the knots for segments beyond the currently dragged element should be kept constant during editing.
    @property {Boolean} showData Enables displaying datapoints on the graph 
    @property {Integer} maxDataDays When datapoint display is enabled, indicates the number of days before asof to show data for. This can be used to speed up display refresh for large goals. Choose -1 to display all datapoints. Choose -1 to show all points.
    @property {Integer} maxFutureDays Indicates how many days beyond asof should be included in the fully zoomed out graph. This is useful for when the goal date is too far beyond asof, making the context graph somewhat useless in terms of its interface utility.

    @property {object}  divTable Binds the road table to a div element
    @property {Number} tableHeight Height of the graph matrix table. Choose 0 for unspecified
    @property {Boolean} tableCheckboxes Chooses whether the graph matrix table should include checkboxes for choosing the field to be automatically computed.
    @property {Boolean} reverseTable Indicates whether the graph matrix table should be shown with the earliest rows first (normal) or most recent rows first(reversed).
    @property {Boolean} tableAutoScroll Indicates whether the auto-scrolling feature for the graph matrix table should be enabled such that when the mouse moves over knots, dots or road elements, the corresponding table row is scrolled to be visible in the table. This is particularly useful when tableHeight is explicitly specified and is nonzero.
    @property {Boolean} tableUpdateOnDrag Chooses whether the graph matrix table should be dynamically updated during the dragging of road knots, dots and segments. Enabling this may induce some lagginess, particularly on Firefox due to more components being updated during dragging
  
  
    @property {function} onRoadChange Callback function that gets invoked when the road is finished loading or has been edited by the user. Various interface functions can then be used to retrieve the new road state. This is also useful to update the state of undo/redo and submit buttons based on how many edits have been done on the original road.
    @property {function} onError Callback function that gets invoked when an error is encountered  in loading, processing, drawing or editing the road. 

    @property {object} zoomButton Visual parameters for the zoom in/out buttons. "factor" indicates how much to zoom in/out per click. e.g. { size: 40, opacity: 0.6, factor: 1.5 }
    @property {object} bullsEye Size of the bullseye image in the focus and context graphs e.g. { size: 40, ctxsize: 20 }
    @property {object} roadDot Visual parameters for draggable road dots e.g. { size: 5, ctxsize: 3, border: 1.5, ctxborder: 1 }
    @property {object} roadKnot Visual parameters for draggable road knots and removal buttons e.g. { width: 3, rmbtnscale: 0.6 }
    @property {object} roadLine Visual parameters for draggable road lines e.g. { width: 3, ctxwidth: 2 }
    @property {object} oldRoadLine Visual parameters for fixed lines for the original road e.g. { width: 3, ctxwidth: 2, dash: 32, ctxdash: 16 }
    @property {object} dataPoint Visual parameters for data points (past, flatlined and hollow) e.g. { size: 5, fsize: 5, hsize: 2.5 }
    @property {object} horizon Visual parameters for the akrasia horizon e.g. { width: 2, ctxwidth: 1, dash: 8, ctxdash: 6, font: 12, ctxfont: 9 }
    @property {object} today Visual parameters for vertical line for asof  e.g. { width: 2, ctxwidth: 1, font: 12, ctxfont: 9 }
    @property {object} watermark Visual parameters for watermarks e.g. { height:170, fntsize:130 }
    @property {object} guidelines Visual parameters for guidelines e.g. { width:2, weekwidth:4 }
    @property {object} maxfluxline Visual parameter for maxfluxline (width)
    @property {object} stdfluxline Visual parameter for stdfluxline (width)

    @property {object} textBox Visual parameters for text boxes shown during dragging e.g. { margin: 3 }
    @property {object} odomReset Visual parameters for odometer resets e.g. { width: 0.5, dash: 8 }
    

  @property {object} roadLineCol Colors for road segments for the editor, e.g. { valid: "black", invalid:"#ca1212", selected:"yellow"}
  @property {object} roadDotCol Colors for the road dots for the editor, e.g. { fixed: "darkgray", editable:"#c2c2c2", selected: "yellow"}
  @property {object} roadKnotCol Colors for the road knots (vertical) for the editor, e.g. { dflt: "#c2c2c2", selected: "yellow", rmbtn: "black", rmbtnsel: "red"}
  @property {object} textBoxCol Colors for text boxes e.g. { bg: "#ffffff", stroke:"#d0d0d0"}
  @property {object} roadTableCol Colors for the road table e.g. { bg:"#ffffff", bgHighlight: "#fffb55", text:"#000000", textDisabled: "#aaaaaa", bgDisabled:"#f2f2f2"}
  @property {object} dataPointCol Colors for datapoints, e.g. { future: "#909090", stroke: "lightgray"}
  @property {object} halfPlaneCol Colors for the yellow brick half plane. e.g. { fill: "#ffffe8" }
  @property {object} pastBoxCol Colors for the past, e.g. { fill: "#f8f8f8", opacity:0.5 }
  @property {object} odomResetCol Colors for odometer reset indicators, e.g. { dflt: "#c2c2c2" }
  
*/

/** bgraph object constructor. Creates an empty beeminder graph and/or road
 * matrix table with the supplied options. Particular goal details may later be
 * loaded with {@link bgraph~loadGoal} or {@link loadGoalFromURL} functions.

 @memberof module:bgraph
 @constructs bgraph
 @param {BGraphOptions} options JSON input with various graph options
*/
const bgraph = function(options) { // BEGIN bgraph object constructor ------------

//console.debug("beebrain constructor ("+gid+"): ")
const self = this // what OOP magic is this? can we just use "this" on next line?
let opts = config(self, options)
const curid = gid
gid++

// Various dimensions and boxes
let yaxisw = 50
let sw = opts.svgSize.width
let sh = opts.svgSize.height
let plotbox, brushbox, plotpad, contextpad

let zoombtnsize = opts.zoomButton.size
let zoombtnscale = zoombtnsize / 540
let zoombtntr

// Graph components
let svg, defs, graphs, buttonarea, stathead, focus, focusclip, plot,
    context, ctxclip, ctxplot, 
    xSc, nXSc, xAxis, xAxisT, xGrid, xAxisObj, xAxisObjT, xGridObj,
    ySc, nYSc, yAxis, yAxisR, yAxisObj, yAxisObjR, yAxisLabel,
    xScB, xAxisB, xAxisObjB, yScB,
    gPB, gYBHP, gYBHPlines, gPink, gPinkPat, gTapePat, gGrid, gOResets,
    gPastText,
    gGuides, gMaxflux, gStdflux, gRazr, gOldBullseye, 
    gKnots, gSteppy, gSteppyPts, gRosy, gRosyPts, gMovingAv,
    gAura, gDerails, gAllpts, gDpts, gHollow, gFlat, 
    gBullseye, gRoads, gDots, gWatermark, gHashtags, gHorizon, gHorizonText,
    gRedTape,
    zoomarea, axisZoom, zoomin, zoomout,  
    brushObj, brush, focusrect, topLeft, dataTopLeft,
    scf = 1, oldscf = 0
  
// These are svg defs that will created dynamically only when needed
 let beyegrp, beyepgrp, infgrp, sklgrp, smlgrp

// Internal state for the graph
let lastError = null
let undoBuffer = [] // Array of previous roads for undo
let redoBuffer = [] // Array of future roads for redo
let processing = false
let loading = false
let hidden = false
let mobileOrTablet = onMobileOrTablet()
let dataf, alldataf
let horindex = null // Road segment index including the horizon
let iroad = []  // Initial road 
let igoal = {}  // Initial goal object
  
// Beebrain state objects
let bbr, gol = {}, road = []
let data = [], rawdata = [], alldata = [], dtd = [], iso = []

function getiso(val) {
  if (iso[val] === undefined) iso[val] = br.isoline(road, dtd, gol, val)
  return iso[val]
}

function getisopath( val, xr ) {
  const isoline = getiso(val)
  if (xr == null) xr = [-Infinity, Infinity]
  let x = isoline[0][0]
  let y = isoline[0][1]
  if (x < xr[0]) { x = xr[0]; y = br.isoval(isoline, x) }
  let d = "M"+r1(nXSc(x*SMS))+" "+r1(nYSc(y))
  let a = bu.searchHigh(isoline, p => p[0] < xr[0] ? -1 : 1)
  let b = bu.searchHigh(isoline, p => p[0] < xr[1] ? -1 : 1)
  if (b > isoline.length - 1) b = isoline.length - 1
  for (let i = a; i <= b; i++) {
    d += " L"+r1(nXSc(isoline[i][0]*SMS))+" "+r1(nYSc(isoline[i][1]))
  }
  return d
}
  
// Compute lane width (the delta between yellow guiding lines) based on
// isolines on the left or right border for the graph depending on dir*yaw. If
// dir*yaw > 0 (like do-more), the left side is considered, otherwise the right
// side. The average lane width is computed by computing isolines for dtd=0 and
// dtd=365 and dividing it by 365 to overcome isolines coinciding for flat
// regions.
function isolnwborder(xr) {
  let lnw = 0
  const numdays = min(opts.maxFutureDays, ceil((gol.tfin-gol.tini)/SID))
  const center = getiso(0)
  const oneday = getiso(numdays)
//TODO: switch to this version
//const edge = gol.yaw*gol.dir > 0 ? 0 : 1 // left edge for MOAR/PHAT
//return abs(br.isoval(center, xr[edge])-br.isoval(oneday, xr[edge])) / numdays

  if (gol.yaw*gol.dir > 0) {
    lnw = abs(br.isoval(center, xr[0])-br.isoval(oneday, xr[0])) / numdays
  } else {
    lnw = abs(br.isoval(center, xr[1])-br.isoval(oneday, xr[1])) / numdays
  }
  return lnw
}

/** Limits an svg coordinate to 1 or 3 digits after the decimal 
 @param {Number} x Input number 
*/
function r1(x) { return round(x*10)/10 }
function r3(x) { return round(x*1000)/1000 }

/** Resets the internal goal object, clearing out previous data. */
function resetGoal() {
  // Initialize goal with sane values
  gol = {}
  gol.yaw = +1; gol.dir = +1
  gol.tcur = 0; gol.vcur = 0
  const now = moment.utc()
  now.hour(0); now.minute(0); now.second(0); now.millisecond(0)
  gol.asof = now.unix()
  gol.horizon = gol.asof + bu.AKH - SID
  gol.xMin = gol.asof;  gol.xMax = gol.horizon
  gol.tmin = gol.asof;  gol.tmax = gol.horizon
  gol.yMin = -1;        gol.yMax = 1

  igoal = bu.deepcopy(gol); road = []; iroad = []; data = []; alldata = []
}
resetGoal()

/** Recompute padding value and bounding boxes for various components in the
 * graph. In particular, plotpad, contextpad, plotbox, and contextbox. */
function computeBoxes() {
  plotpad    = bu.extendo({}, opts.focusPad)
  contextpad = bu.extendo({}, opts.ctxPad)
  if (gol.stathead && !opts.roadEditor) plotpad.top += 15
  plotpad.left  += yaxisw
  plotpad.right += yaxisw+(gol.hidey?8:0) // Extra padding if yaxis text hidden
  contextpad.left += yaxisw
  contextpad.right += yaxisw+(gol.hidey?8:0)
  plotbox = {
    x:      opts.focusRect.x      + plotpad.left,
    y:      opts.focusRect.y      + plotpad.top,
    width:  opts.focusRect.width  - plotpad.left - plotpad.right, 
    height: opts.focusRect.height - plotpad.top  - plotpad.bottom,
  }
  brushbox = {
    x:      opts.ctxRect.x      + contextpad.left,
    y:      opts.ctxRect.y      + contextpad.top,
    width:  opts.ctxRect.width  - contextpad.left - contextpad.right, 
    height: opts.ctxRect.height - contextpad.top  - contextpad.bottom,
  }
  zoombtntr = {
    botin:  "translate("+(plotbox.width-2*(zoombtnsize+5))
                    +","+(plotbox.height -(zoombtnsize+5))
                    +") scale("+zoombtnscale+","+zoombtnscale+")",
    botout: "translate("+(plotbox.width -(zoombtnsize+5))
                    +","+(plotbox.height-(zoombtnsize+5))
                    +") scale("+zoombtnscale+","+zoombtnscale+")",
    topin: "translate("+(plotbox.width-2*(zoombtnsize+5))
                    +",5) scale("+zoombtnscale+","+zoombtnscale+")",
    topout: "translate("+(plotbox.width-(zoombtnsize+5))
                    +",5) scale("+zoombtnscale+","+zoombtnscale+")" }
}
computeBoxes()

/** Utility function to show a shaded overlay with a message consisting of
 multiple lines supplied in the array argument.
 @param {String[]} msgs Array of messages, one for each line
 @param {Number} [fs=-1] Font size. height/15 if -1
 @param {String} [fw="bold"} Font weight
 @param {Object} [box=null] Bounding box {x,y,w,h} for the overlay; default null
 @param {String} [cls="overlay} CSS class of the created overlay
 @param {Boolean} [shd=true] Shade out graph if true
*/
function showOverlay(msgs, fs=-1, fw="bold",
                     box=null, cls="overlay", shd=true, animate=false,
                     parent=null) {
  if (opts.divGraph == null) return
  if (box == null) box ={x:sw/20, y:sh/5, w:sw-2*sw/20, h:sh-2*sh/5}
  if (parent == null) parent = svg
  let pg = parent.select("g."+cls)
  if (pg.empty()) {
    pg = parent.append('g').attr('class', cls)
    if (shd) {
      pg.append('svg:rect').attr('x',             0)
                           .attr('y',             0)
                           .attr('width',         sw)
                           .attr('height',        sh)
                           .style('fill',         bu.BHUE.WITE)
                           .style('fill-opacity', 0.5)
    }
    pg.append('svg:rect').attr("class",  "textbox")
                         .attr('x',      box.x)
                         .attr('y',      box.y)
                         .attr('width',  box.w)
                         .attr('height', box.h)
  }
  pg.selectAll(".loading").remove()
  const nummsgs = msgs.length
  if (fs < 0) fs = sh/15
  const lh = fs * 1.1
  for (let i = 0; i < nummsgs; i++) {
    pg.append('svg:text').attr('class', 'loading')
      .attr('x',            box.x+box.w/2)
      .attr('y',            (box.y+box.h/2) - ((nummsgs-1)*lh)/2+i*lh+fs/2-3)
      .attr('font-size',    fs)
      .style('font-size',   fs)
      .style('font-weight', fw)
      .text(msgs[i])
  }
  if (animate) 
    pg.style("opacity", 0).transition().duration(200).style("opacity", 1)
}
/** Removes the message overlay created by {@link 
    bgraph~showOverlay showOverlay()}
    @param {String} [cls="overlay"] CSS class for the overlay to remove
*/
function removeOverlay(cls = "overlay", animate = false, parent = null) {
  //console.debug("removeOverlay("+self.id+")")
  if (opts.divGraph == null) return
  if (parent == null) parent = svg
  let pg = parent.selectAll("g."+cls)
  if (animate) pg.style("opacity", 1).transition().duration(200)
                 .style("opacity", 0).remove()
  else pg.remove()
}

/** Creates all SVG graph components if a graph DIV is provided. Called once
   when the bgraph object is created. */
function createGraph() {
  const div = opts.divGraph
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) div.removeChild(div.firstChild)
  
  // Initialize the div and the SVG
  svg = d3.select(div).attr("class", "bmndrgraph")
    .append('svg:svg')
    .attr("id",                  "svg"+curid)
    .attr("xmlns",               "http://www.w3.org/2000/svg")
    .attr("xmlns:xlink",         "http://www.w3.org/1999/xlink")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox",             "0 0 "+sw+" "+sh)
    .attr('width',               "100%")
    .attr('height',              "100%")
    .attr('class',               'bmndrsvg')
  
  // Common SVG definitions, including clip paths
  defs = svg.append('defs')
  defs.insert('style').attr('type','text/css').text(SVGStyle)
  // Dot types:
  //               col r
  // Rosy dots   : ROSE
  // Steppy pts  : PURP
  // All pts     : 
  // Editor data :
  // Graph data  :
  // Graph hollow:
  defs.insert('style').attr("id", "dynstyle"+curid).attr('type','text/css').text("")
  
  defs.append("clipPath")
    .attr("id", "plotclip"+curid)
    .append("rect").attr("x", 0).attr("y", 0)
    .attr("width", plotbox.width).attr("height", plotbox.height)
  defs.append("clipPath")
    .attr("id", "brushclip"+curid)
    .append("rect").attr("x", 0).attr("y", 0)
    .attr("width", brushbox.width).attr("height", brushbox.height)
  defs.append("clipPath")
    .attr("id", "buttonareaclip"+curid)
    .append("rect").attr("x", plotbox.x).attr("y", 0)
    .attr("width", plotbox.width).attr("height", plotpad.top)
  defs.append("path")
    .style("stroke", "none").attr("id", "rightarrow")
    .attr("d", "M 55,0 -35,45 -35,-45 z")
  
  defs.append("path")
    .style("stroke", "none").attr("id", "downarrow")
    .attr("d", "M 0,40 45,-50 -45,-50 z")
  
  defs.append("path")
    .style("stroke", "none").attr("id", "uparrow")
    .attr("d", "M 0,-40 45,50 -45,50 z")
  
  gPinkPat = defs.append("pattern").attr("id",              "pinkzonepat"+curid)
                                   .attr("x",                0)
                                   .attr("y",                0)
                                   .attr("width",            10)
                                   .attr("height",           10)
                                   .attr("patternTransform", "rotate(45)")
                                   .attr("patternUnits",     "userSpaceOnUse")
  gPinkPat.append("rect").attr("x",                0)
                         .attr("y",                0)
                         .attr("width",            10)
                         .attr("height",           10)
                         .attr("fill", bu.BHUE.PINK)
  gPinkPat.append("line").attr("x1",            0)
                         .attr("y1",            0)
                         .attr("x2",            0)
                         .attr("y2",            10)
                         .style("stroke",       "#aaaaaa")
                         .style("stroke-width", 1)
  
  gTapePat = defs.append("pattern").attr("id",              "tapepat"+curid)
                                   .attr("x",                0)
                                   .attr("y",                0)
                                   .attr("width",            20)
                                   .attr("height",           20)
                                   .attr("patternTransform", "rotate(45)")
                                   .attr("patternUnits",     "userSpaceOnUse")
  gTapePat.append("rect").attr("x",                0)
                         .attr("y",                0)
                         .attr("width",            20)
                         .attr("height",           20)
                         .attr("fill", "#ffffff")
  gTapePat.append("line").attr("x1",            0)
                         .attr("y1",            0)
                         .attr("x2",            20)
                         .attr("y2",            0)
                         .style("stroke",       "#ff5555")
                         .style("stroke-width", 25)

  const buttongrp = defs.append("g").attr("id", "removebutton")
  buttongrp.append("circle").attr("cx",   14)
                            .attr("cy",   14)
                            .attr("r",    16)
                            .attr('fill', 'white')
  buttongrp.append("path")
    .attr("d", "M13.98,0C6.259,0,0,6.261,0,13.983c0,7.721,6.259,13.982,13.98,13.982c7.725,0,13.985-6.262,13.985-13.982C27.965,6.261,21.705,0,13.98,0z M19.992,17.769l-2.227,2.224c0,0-3.523-3.78-3.786-3.78c-0.259,0-3.783,3.78-3.783,3.78l-2.228-2.224c0,0,3.784-3.472,3.784-3.781c0-0.314-3.784-3.787-3.784-3.787l2.228-2.229c0,0,3.553,3.782,3.783,3.782c0.232,0,3.786-3.782,3.786-3.782l2.227,2.229c0,0-3.785,3.523-3.785,3.787C16.207,14.239,19.992,17.769,19.992,17.769z")
  

  const zoomingrp = defs.append("g").attr("id", "zoominbtn")
  if (!opts.headless && opts.buttonZoom) {
    // Zoom buttons are not visible for SVG output in headless mode
    zoomingrp.append("path").style("fill", "white")
      .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z")
    zoomingrp.append("path")
      .attr("d", "m 308.21,155.10302 -76.553,0 0,76.552 -76.552,0 0,76.553 76.552,0 0,76.552 76.553,0 0,-76.552 76.552,0 0,-76.553 -76.552,0 z m 229.659,114.829 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z")
  }
  
  const zoomoutgrp = defs.append("g").attr("id", "zoomoutbtn")
  if (!opts.headless && opts.buttonZoom) {
    // Zoom buttons are not visible for SVG output in headless mode
    zoomoutgrp.append("path").style("fill", "white")
      .attr("d", "m 530.86356,264.94116 a 264.05649,261.30591 0 1 1 -528.1129802,0 264.05649,261.30591 0 1 1 528.1129802,0 z")
    zoomoutgrp.append("path")
      .attr("d", "m 155.105,231.65502 0,76.553 229.657,0 0,-76.553 c -76.55233,0 -153.10467,0 -229.657,0 z m 382.764,38.277 C 537.869,119.51007 420.50428,1.9980234 269.935,1.9980234 121.959,1.9980234 2.0000001,121.95602 2.0000001,269.93202 c 0,147.976 117.2473599,267.934 267.9339999,267.934 150.68664,0 267.935,-117.51205 267.935,-267.934 z m -267.935,191.381 c -105.681,0 -191.381,-85.7 -191.381,-191.381 0,-105.681 85.701,-191.380996 191.381,-191.380996 105.681,0 191.381,85.700996 191.381,191.380996 0,105.681 -85.7,191.381 -191.381,191.381 z")
  }
  
  // Create rectange to monitor zoom events and install handlers
  zoomarea = svg.append('rect').attr("class",  "zoomarea")
                               .attr("x",      plotbox.x)
                               .attr("y",      plotbox.y)
                               .attr("color",  bu.BHUE.REDDOT)
                               .attr("width",  plotbox.width)
                               .attr("height", plotbox.height)
  const oldscroll = zoomarea.on("wheel.scroll")
  const scrollinfo = {shown: false, timeout: null}
  
  const onscroll = function() {
    if (scrollinfo.timeout != null) {
      clearTimeout(scrollinfo.timeout)
      scrollinfo.timeout = null
    }
    if (d3.event.ctrlKey) {
      removeOverlay("zoominfo",true, plot)
      scrollinfo.shown = false
      return
    }
    if (!scrollinfo.shown) {
      showOverlay(["Use ctrl+scroll to zoom"], -1,"normal",
                  {x:0,y:0,w:plotbox.width,h:plotbox.height},
                  "zoominfo", false, true, plot)
      scrollinfo.shown = true
    }
    scrollinfo.timeout= setTimeout(() => {removeOverlay("zoominfo", true);
                                          scrollinfo.shown = false},1000)
 }
  const onmove = function() {
    if (scrollinfo.timeout != null) {
      clearTimeout(scrollinfo.timeout)
      scrollinfo.timeout = null
    }
    removeOverlay("zoominfo",true)
    scrollinfo.shown = false
  }
  zoomarea.on("wheel.scroll", onscroll, {passive:false})
  zoomarea.on("mousedown.move", onmove)
  //zoomarea.on("touchstart", ()=>{console.log("touchstart")} )
  //zoomarea.on("touchmove", ()=>{console.log("touchmove")} )
  //zoomarea.on("touchend", ()=>{console.log("touchend")} )

  axisZoom = d3.zoom()
    .extent([[0, 0], [plotbox.width, plotbox.height]])
    .scaleExtent([1, Infinity])
    .translateExtent([[0, 0], [plotbox.width, plotbox.height]])
    .filter(function(){ return (d3.event.type != "wheel" || d3.event.ctrlKey) })
    .on("zoom", zoomed)
  zoomarea.call(axisZoom)
  if (onMobileOrTablet()) {
    let pressTimer = null, pressX
    const oldTouchStart = zoomarea.on("touchstart.zoom")
    const oldTouchMove  = zoomarea.on("touchmove.zoom")
    const oldTouchEnd   = zoomarea.on("touchend.zoom")
    
    zoomarea
      .on("touchstart.zoom", function(){ 
        const bbox = this.getBoundingClientRect()
        pressX = d3.event.touches.item(0).pageX - bbox.left
        const  newx = nXSc.invert(pressX)
        if (pressTimer == null && d3.event.touches.length == 1) 
          pressTimer = window.setTimeout(
            () => { if (newx != null) addNewDot(newx/SMS) }, 1000)
        oldTouchStart.apply(this, arguments)} )
      .on("touchmove.zoom", function(){ window.clearTimeout(pressTimer); pressTimer = null; oldTouchMove.apply(this, arguments)})
      .on("touchend.zoom", function(){ clearTimeout(pressTimer); pressTimer = null; oldTouchEnd.apply(this, arguments)} )
  }
  function dotAdded() {
    const mouse = d3.mouse(svg.node())
    const newx = nXSc.invert(mouse[0]-plotpad.left)
    addNewDot(newx/SMS)
  }
  function dotAddedShift() {
    if (d3.event.shiftKey) dotAdded()
    else clearSelection()  
  }
  if (opts.roadEditor) {
    zoomarea.on("click", dotAddedShift)
    zoomarea.on("dblclick.zoom", dotAdded)
  } else {
    zoomarea.on("dblclick.zoom", null)
  }
  
  focus = svg.append('g')
    .attr('class', 'focus')
    .attr('transform', 'translate('+opts.focusRect.x
          +','+opts.focusRect.y+')');
  buttonarea = focus.append('g')
    .attr('clip-path', 'url(#buttonareaclip'+curid+')')
    .attr('class', 'buttonarea'); 
  focusclip = focus.append('g')
    .attr('class', 'focusclip')
    .attr('clip-path', 'url(#plotclip'+curid+')')
    .attr('transform', 'translate('+plotpad.left
          +','+plotpad.top+')');
  plot = focusclip.append('g').attr('class', 'plot');
  
  stathead = focus.append('svg:text').attr("x", sw/2).attr("y", 15)
    .attr("width", plotbox.width)
    .attr('class', 'svgtxt')
    .style("font-size", "80%")
    .attr('text-anchor', 'middle')
  
  // Order here determines z-order... 
  // (The commented z-values are to remember previous order for experimenting)
  gPB          = plot.append('g').attr('id', 'pastboxgrp')     // z = 01
  gYBHP        = plot.append('g').attr('id', 'ybhpgrp')        // z = 02
  gWatermark   = plot.append('g').attr('id', 'wmarkgrp')       // z = 03
  gGuides      = plot.append('g').attr('id', 'guidegrp')       // z = 04
  gMaxflux     = plot.append('g').attr('id', 'maxfluxgrp')     // z = 05
  gStdflux     = plot.append('g').attr('id', 'stdfluxgrp')     // z = 06
  gYBHPlines   = plot.append('g').attr('id', 'ybhplinesgrp')   // z = 07
  gRazr        = plot.append('g').attr('id', 'razrgrp')        // z = 08
  gAura        = plot.append('g').attr('id', 'auragrp')        // z = 09
  gPink        = plot.append('g').attr('id', 'pinkgrp')        // z = 10
  gOldBullseye = plot.append('g').attr('id', 'oldbullseyegrp') // z = 11
  gBullseye    = plot.append('g').attr('id', 'bullseyegrp')    // z = 12
  gGrid        = plot.append('g').attr('id', 'grid')           // z = 13
  gOResets     = plot.append('g').attr('id', 'oresetgrp')      // z = 14
  gKnots       = plot.append('g').attr('id', 'knotgrp')        // z = 15
  gSteppy      = plot.append('g').attr('id', 'steppygrp')      // z = 16
  gRosy        = plot.append('g').attr('id', 'rosygrp')        // z = 17
  gRosyPts     = plot.append('g').attr('id', 'rosyptsgrp')     // z = 18
  gDerails     = plot.append('g').attr('id', 'derailsgrp')     // z = 19
  gAllpts      = plot.append('g').attr('id', 'allptsgrp')      // z = 20
  gMovingAv    = plot.append('g').attr('id', 'movingavgrp')    // z = 21
  gSteppyPts   = plot.append('g').attr('id', 'steppyptsgrp')   // z = 22
  gDpts        = plot.append('g').attr('id', 'datapointgrp')   // z = 23
  gHollow      = plot.append('g').attr('id', 'hollowgrp')      // z = 24
  gFlat        = plot.append('g').attr('id', 'flatlinegrp')    // z = 25
  gHashtags    = plot.append('g').attr('id', 'hashtaggrp')     // z = 26
  gRoads       = plot.append('g').attr('id', 'roadgrp')        // z = 27
  gDots        = plot.append('g').attr('id', 'dotgrp')         // z = 28
  gHorizon     = plot.append('g').attr('id', 'horgrp')         // z = 29
  gHorizonText = plot.append('g').attr('id', 'hortxtgrp')      // z = 30
  gPastText    = plot.append('g').attr('id', 'pasttxtgrp')     // z = 31

  gRedTape = plot.append('g').attr('visibility', 'hidden')
  // wwidth and height will be set by resizeGraph later
  gRedTape.append('rect').attr('x', 0).attr('y', 0)
    .attr('stroke-width', 20).attr('stroke', "url(#tapepat"+curid+")")
    .attr('fill', 'none')
  // x coordinate will be set by resizeGraph later
  gRedTape.append('text').attr('y', 45)
    .attr('paint-order', 'stroke')
    .attr('stroke-width', '2px').attr('stroke', '#a00000')
    .attr('font-size', "35px").attr('text-anchor', 'middle')
    .attr('fill', '#ff0000')
    .text("Error") // originally "road can't get easier"

  zoomin = focusclip.append("svg:use")
    .attr("class","zoomin")
    .attr("xlink:href", "#zoominbtn")
    .attr("opacity",opts.zoomButton.opacity)
    .attr("transform", zoombtntr.botin)
    .on("click", () => { zoomarea.call(axisZoom.scaleBy, 
                                       opts.zoomButton.factor) })
    .on("mouseover", () =>{
      if (!mobileOrTablet) d3.select(this).style("fill", "red")})
    .on("mouseout",(d,i) => {d3.select(this).style("fill", "black")})
  zoomout = focusclip.append("svg:use")
    .attr("class",      "zoomout")
    .attr("xlink:href", "#zoomoutbtn")
    .attr("opacity",    opts.zoomButton.opacity)
    .attr("transform",  zoombtntr.botout)
    .on("click", () => { zoomarea.call(axisZoom.scaleBy, 
                                       1/opts.zoomButton.factor) })
    .on("mouseover", () => {
      if (!mobileOrTablet) d3.select(this).style("fill", "red") })
    .on("mouseout",(d,i) => { d3.select(this).style("fill", "black") })

  // Create and initialize the x and y axes
  xSc   = d3.scaleUtc().range([0,plotbox.width])
  xAxis = d3.axisBottom(xSc).ticks(6)

  xAxisObj = focus.append('g')        
    .attr("class", "axis")
    .attr("transform", "translate("+plotbox.x+"," 
          + (plotpad.top+plotbox.height) + ")")
    .call(xAxis)
  xGrid = d3.axisTop(xSc).ticks(6).tickFormat("")
  xGridObj = gGrid.append('g')
    .attr("class", "grid")
    .attr("transform", "translate(0,"+(plotbox.height)+")")
    .call(xGrid)
  xAxisT = d3.axisTop(xSc).ticks(6)
  xAxisObjT = focus.append('g')
    .attr("class", "axis")
    .attr("transform", "translate("+plotbox.x+"," + (plotpad.top) + ")")
    .call(xAxisT)

  if (opts.roadEditor) {
    xGridObj.attr('display', 'none')
    xAxisObjT.attr('display', 'none')
  }

  ySc    = d3.scaleLinear().range([plotbox.height, 0])
  yAxis  = d3.axisLeft(ySc).ticks(8).tickSize(6).tickSizeOuter(0)
  yAxisR = d3.axisRight(ySc).ticks(8).tickSize(6).tickSizeOuter(0)
  yAxisObj = focus.append('g')        
    .attr("class", "axis")
    .attr("transform", "translate(" + plotpad.left + ","+plotpad.top+")")
    .call(yAxis)
  yAxisObjR = focus.append('g').attr("class", "axis")
    .attr("transform", "translate(" 
                       + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
    .call(yAxisR)
  yAxisLabel = focus.append('text')        
    .attr("class", "axislabel")
    .attr("transform", 
          "translate(15,"+(plotbox.height/2+plotpad.top)+") rotate(-90)")
    .text("") // used to say "deneme" but was user-visible in error graphs
  
  // Create brush area
  context = svg.append('g')
    .attr('class', 'brush')
    .attr('transform', 'translate('+opts.ctxRect.x+','+opts.ctxRect.y+')')
  ctxclip = context.append('g')
    .attr('clip-path', 'url(#brushclip'+curid+')')
    .attr('transform', 'translate('+contextpad.left+','+contextpad.top+')')
  ctxplot = ctxclip.append('g').attr('class', 'context')
  xScB = d3.scaleUtc().range([0,brushbox.width])
  xAxisB = d3.axisBottom(xScB).ticks(6)
  xAxisObjB = context.append('g')
    .attr("class", "axis")
    .attr("transform", "translate("+brushbox.x+"," 
          + (contextpad.top+brushbox.height) + ")")
    .call(xAxisB)
  yScB = d3.scaleLinear().range([brushbox.height, 0])

  brushObj = d3.brushX()
    .extent([[0, 0], [brushbox.width, brushbox.height]])
    .on("brush", brushed);

  brush = ctxplot.append("g").attr("class", "brush").call(brushObj)
  focusrect = ctxclip.append("rect")
    .attr("class",             "focusrect")
    .attr("x",                 1)
    .attr("y",                 1)
    .attr("width",             brushbox.width-2)
    .attr("height",            brushbox.height-2)
    .attr("fill",              "none")
    .style("stroke",           "black")
    .style("stroke-width",     1)
    .style("stroke-dasharray", "8,4,2,4")
  nXSc = xSc; nYSc = ySc
}

/** Resize various SVG graph components when any of the bounding boxes change.
 * This is primarily due to the text width for y-axis labels and tick marks
 * changing, as handled by the {@link 
 * bgraph~handleYAxisWidth handleYAxisWidth()} function. */
function resizeGraph() {
  //console.debug("id="+curid+", resizeGraph()")

  const div = opts.divGraph
  if (div === null) return

  const xr = [nXSc.invert(0), nXSc.invert(plotbox.width)]
  //console.debug(xr)
  computeBoxes()
  // Common SVG definitions, including clip paths
  defs.select('#plotclip'+curid+' > rect')
    .attr("width",  plotbox.width)
    .attr("height", plotbox.height)
  defs.select('#brushclip'+curid+' > rect')
    .attr("width",  brushbox.width)
    .attr("height", brushbox.height)
  defs.select('#buttonareaclip'+curid+' > rect')
    .attr("x", plotbox.x)
    .attr("y", 0)
    .attr("width",  plotbox.width)
    .attr("height", plotbox.height);
  zoomarea.attr("x", plotbox.x)
    .attr("y", plotbox.y)
    .attr("width", plotbox.width)
    .attr("height", plotbox.height)
  axisZoom.extent([[0, 0], [plotbox.width, plotbox.height]])
    .scaleExtent([1, Infinity])
    .translateExtent([[0, 0], [plotbox.width, plotbox.height]])
  focusclip.attr('transform', 'translate('+plotpad.left+','+plotpad.top+')')
  zoomin.attr( "transform", zoombtntr.botin)
  zoomout.attr("transform", zoombtntr.botout)
  xSc.range( [0, plotbox.width])
  nXSc.range([0, plotbox.width])
  xAxisObj.attr("transform", "translate("+plotbox.x+"," 
                   + (plotpad.top+plotbox.height) + ")").call(xAxis.scale(nXSc))
  xGridObj.attr("transform", "translate(0,"+(plotbox.height)+")").call(xGrid)
  xAxisObjT.attr("transform", "translate("+plotbox.x+","+(plotpad.top)+")")
    .call(xAxisT.scale(nXSc))

  gRedTape.select('rect').attr('width', plotbox.width).attr('height', plotbox.height)
  gRedTape.select('text').attr('x', plotbox.width/2)
    
  ySc.range( [0, plotbox.height])
  nYSc.range([0, plotbox.height])
  yAxisObj.attr("transform", "translate("+plotpad.left+","+plotpad.top+")")
    .call(yAxis.scale(nYSc))

  yAxisObjR.attr("transform", "translate(" 
                           + (plotpad.left+plotbox.width) + ","+plotpad.top+")")
    .call(yAxisR.scale(nYSc))

  yAxisLabel.attr("transform", 
                  "translate(15,"+(plotbox.height/2+plotpad.top)
                                                               +") rotate(-90)")
  ctxclip.attr('transform', 'translate('+contextpad.left+','+contextpad.top+')')
  //console.debug("Scaling brush x axis to "+brushbox.width);
  xScB.range([0,brushbox.width])
  xAxisObjB.attr("transform", "translate("+brushbox.x+"," 
                 + (contextpad.top+brushbox.height) + ")")
    .call(xAxisB)
  yScB.range([brushbox.height, 0])
  brushObj.extent([[0, 0], [brushbox.width, brushbox.height]])
  brush.call(brushObj)

  // Go back to previous zoom level in case x-axis size / limits have changed
  let s = xr.map(xSc)
  zoomarea.call(axisZoom.transform, d3.zoomIdentity
                .scale(plotbox.width / (s[1] - s[0]))
                .translate(-s[0], 0))
  //console.debug(s)
  adjustYScale()
}

let databody, dataslider, dsliderbusy = false
let datarange, dataindex = 0, dataselected=-1
function updateDataSliderValue() {
  if (!dataslider) return
  dataslider.node().value = dataindex
}
  
function selectDataIndex(ind) {
  ind = rawdata.length-ind-1 // reverse table
  // Make sure the data table is visible before selection
  if (!databody.node().offsetParent) return
  dataselected = ind
  const midpt = Math.floor(opts.dataTableSize/2)
  const tbindex = Math.max(0, Math.min(ind-midpt, rawdata.length-opts.dataTableSize))
  dataindex = tbindex
  updateDataSliderValue()
  updateDataTable()
}
function unselectDataIndex() {
  dataselected = -1
  updateDataTable()
}
function dsliderupdate(val) {
  dsliderbusy = true
  dataindex = parseInt(val)
  updateDataTable()
  dsliderbusy = false
}
function dsliderscroll() {
  if (dtableedit) return
  d3.event.preventDefault()
  if (d3.event.deltaY < 0) {
    if (dataindex == 0) return
    dataindex -= 1
  } else {
    if (dataindex >= rawdata.length-opts.dataTableSize) return
    dataindex += 1
  }
  updateDataSliderValue()
  updateDataTable()
}
/** Creates the skeleton for the data table and populates it with
 * rows. Cells are created later in updateDueBy using d3 */
const dcellclass = ["id", "dt", "vl", "cmt", "mod", "del"]
const dcellelt = ["span", "div", "div", "div", "button", "button"]
function createDataTable() {
  const div = opts.divData
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) div.removeChild(div.firstChild)

  const divelt = d3.select(div)
  divelt.append("div").attr("id", "dpfloat").attr("class", "floating")
  dataTopLeft = divelt.append("div").attr("id", "datatopleft")
     .style("position", "absolute").style("left", 0).style("top",0)
     .style("width", "1px").style("height", "1px")
     .attr("visibility","hidden")

  divelt.attr("class", "bmndrdata")
  divelt.on("wheel.scroll", dsliderscroll, {passive:false})

  databody = divelt.append("div").attr("class", "dbody") /* Data table body */
  let datacolumns
  datarange = Array(Math.min(rawdata.length, opts.dataTableSize)).fill().map((x,i)=>(i+dataindex))
  datacolumns = ['#', 'DATE', 'VALUE', 'COMMENT', '', ''];
  databody.append("div").attr('class', 'dhdrrow')
    .selectAll("span.dhdrcell").data(datacolumns)
    .enter().append("span").attr('class',(d,i) => ('dhdrcell '+dcellclass[i]))
    .style("text-align", (d,i)=>( (i == 0)?"right":null))
    .text((c)=>c);
  databody
    .selectAll(".drow")
    .data(datarange)
    .join(enter => enter.append("div").attr('class', 'drow'))
  dataslider = divelt.append("input").attr("type", "range").attr("class","dslider")
    .attr("min",0).attr("max",15).attr("value",7).attr("step",1)
    .on("input",function(){dsliderupdate(this.value)})
    .on("change",function(){dsliderupdate(this.value)})
}

function createSvgEl(name) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}
function createXhtmlEl(name) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", name);
}

let dtablebusy = false, dtableedit = null
function getDataRowId() {
  return event.currentTarget.parentElement.getAttribute('id')
}
function getDataInd() {
  const id = getDataRowId()
  const ind = id.match(/drow(\d+)/)
  if (!ind || ind.length < 2) return null
  return ind[1]
}
function getDataId() {
  const ind = getDataInd()
  if (!ind) return null
  const d = rawdata[ind]
  return d[3]?d[3]:ind
}
function dataEdit() {
  const ind = getDataInd()
  if (!dtableedit) {
    // Starting edit
    const id = getDataRowId()
    dtableedit = ind
    dataslider.attr("disabled", true)
    dataFocus.field = null
    dataFocus.oldText = null
    dataFocus.changed = false
  } else {
    // Finishing edit
    if (dataFocus.changed) {

      const did = getDataId()
      const parent = d3.select(event.currentTarget.parentNode)
      const date = bu.dayparse(parent.select(".dt").text(),'-')
      const value = parent.select(".vl").text()
      const comment = parent.select(".cmt").text()
      if (!isNaN(date)&&!isNaN(value)&&ind==dtableedit&&opts.onDataEdit)
        opts.onDataEdit(did, [date, value, comment])
    }
    dataslider.attr("disabled", null)
    dtableedit = null
  }
  updateDataTable()
}
function dataDelete() {
  const ind = getDataInd()
  const did = getDataId()
  if (dtableedit && dtableedit != ind) return 
  if (opts.onDataEdit) opts.onDataEdit(did, null)
  updateDataTable()
}
function dataCancel() {
  dataslider.attr("disabled", null)
  dtableedit = null
  updateDataTable()
}

// Focused field information for the road table
const dataFocus = {
  field: null,
  oldText : null,
  changed : false
}
function dataFocusIn( d, i ){
  if (!opts.onDataEdit || i == 0  || i > 3) return
  if (!dtableedit) {
    // Starting editing
    dataEdit()
  } else if (!d.edit) return
  
  //console.debug('dataFocusIn('+i+') for '+this.parentNode.id);
  dataFocus.field = d3.select(this)
  dataFocus.oldText = dataFocus.field.text()
  destroyDatePicker()
  //let kind = Number(dataFocus.field.node().parentNode.id);
  if (i == 1) {
    let floating = d3.select(opts.divData).select('.floating');
    createDatePicker(dataFocus.field, null, null, floating, dataTopLeft)
  }
}

function dataFocusOut( d, i ){
  if (!opts.onDataEdit || !d.edit || i == 0 || i > 3) return
  //console.debug('tableFocusOut('+i+') for '+this.parentNode.id);
  //let kind = Number(this.parentNode.id)
  const text = d3.select(this).text()
  destroyDatePicker()
  clearSelection()
  if (text === dataFocus.oldText) return
  dataFocus.changed = true
  if (dataFocus.oldText == null) return // ENTER must have been hit
  const val = (i==1 ? bu.dayparse(text, '-') : text)
  if (i != 3 && isNaN(val)) {
    d3.select(this).text(dataFocus.oldText)
    dataFocus.oldText = null
    dataFocus.field = null
    return
  }
  dataFocus.oldText = null
  dataFocus.field = null
}
  
function dataKeyDown(d, i) {
  if (!opts.onDataEdit || !d.edit || i == 0 || i > 3) return
  if (d3.event.keyCode == 13) {
    this.blur()
    const text = d3.select(this).text()
    const val = (i==1 ? bu.dayparse(text, '-') : text)
    if (i != 3 && isNaN(val)) {
      d3.select(this).text(dataFocus.oldText)
      dataFocus.oldText = null
      return
    }
    dataFocus.oldText = d3.select(this).text()
    if (d3.event.ctrlKey) {
      // Ctrl-enter finishes editing
      dataEdit()
    }
  }
}
function updateDataTable() {
  if (dtablebusy) return
  dtablebusy = true
  if (processing) return
  if (opts.divData === null) return

  if (!dsliderbusy) {
    if (rawdata.length <= opts.dataTableSize) dataslider.style("visibility", "hidden")
    else {
      dataslider.style("visibility", "visible")
        .attr("max", rawdata.length-opts.dataTableSize)
        .attr("value", 0)
    }
  }
  
  datarange = Array(Math.min(rawdata.length, opts.dataTableSize)).fill().map((x,i)=>(i+dataindex))
  const elts = databody.selectAll(".drow").data(datarange)
  elts.enter()
    .append("div")
    .attr('class', 'drow')
    .attr("id", d=>("drow"+(rawdata.length-d-1)))
  elts.exit().remove()
  elts.style("box-shadow", (d) => (d==dataselected)?"0 0 0 4px yellow":null)
    .attr("id", d=>("drow"+(rawdata.length-d-1)))
  
  const cells = databody
    .selectAll(".drow")
    .selectAll(".dcell")
    .data((row, i) => {
      if (row >= rawdata.length) return [null, null, null, null, null, null]
      row = rawdata.length-row-1 // reverse table
      let date = bu.dayify(bu.dayparse(rawdata[row][0]), '-')
      let editp = (dtableedit)?(row == dtableedit):false
      return [{txt:row,clk:null,edit:editp},
              {txt:date,clk:null,edit:editp},
              {txt:rawdata[row][1],clk:null,edit:editp},
              {txt:rawdata[row][2],clk:null,edit:editp},
              {txt:editp?'<img class="dicon" src="../src/check.svg"></img>':'<img class="dicon" src="../src/edit.svg" ></img>',clk:dataEdit,edit:editp},
              {txt:editp?'<img class="dicon" src="../src/cancel.svg" ></img>':'<img class="dicon" src="../src/trash.svg"></img>',clk:editp?dataCancel:dataDelete,edit:editp}]
    })

  cells.join(enter=>
             enter.append((d,i)=>(createXhtmlEl(dcellelt[i])))
             .attr('class', (d,i)=>("dcell "+dcellclass[i]))
             .style("border", (d,i)=>( (i == 0)?"0":null))
             .style("text-align", (d,i)=>( (i == 0)?"right":null))
             .on('click', d=>(d.clk?d.clk():null)),
             update=>update)
    .html(d=>{return d.txt})
    .style('visibility', function(d){return (this.tagName==="BUTTON" && (dtableedit && !d.edit))?"hidden":null})
    //.attr('contenteditable', (d,i)=>((dtableedit&&d.edit&&i>0)?true:false))
    .attr('contenteditable', (d,i) => (opts.onDataEdit?(i>0&&i<4):false))
    .on('focusin', dataFocusIn)
    .on('focusout', dataFocusOut)
    .on('keydown', dataKeyDown)
    .style('opacity', (d)=>((!dtableedit || d.edit)?null:0.2))
  
  const buttons = databody.selectAll('button.dcell')
  if (opts.onDataEdit) buttons.style('display', null)
  else buttons.style('display', 'none')

  dtablebusy = false
}
function resetDataTable() {
  if (opts.divData === null) return
  dataindex = 0
  dtableedit = null
  dataslider.attr("disabled", null)
  updateDataSliderValue()
  updateDataTable()
}

let dbbody
function duebylabel(i, now) {
  const mm = moment.unix(gol.asof+i*SID).utc()
  const ds = bu.dayparse(mm.format("YYYYMMDD")) / SID
  if (ds == now-1) return ["Yesterday", bu.BHUE.REDDOT]
  if (ds == now) return ["Today", bu.BHUE.ORNG]
  if (ds == now+1) return ["Tomorrow", bu.BHUE.BLUDOT]
  const dstr = mm.format("ddd (Do)")
  if (ds == now+2) return [dstr, bu.BHUE.GRNDOT]
  return [dstr, bu.BHUE.BLCK]
}
  
/** Creates the skeleton for the dueby table and populates it with
 * rows. Cells are created later in updateDueBy using d3 */
function createDueBy() {
  const div = opts.divDueby
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) div.removeChild(div.firstChild)

  const divelt = d3.select(div)
  dbbody = divelt.append("div").attr("class", "dbbody") /* Dueby table body */
  let dbcolumns
  dbcolumns = ['DAY', 'DELTA', 'TOTAL'];
  dbbody.append("div").attr('class', 'dbhdrrow')
    .selectAll("span.dbhdrcell").data(dbcolumns)
    .enter().append('span').attr('class', 'dbhdrcell')
    .text((c)=>c);
  dbbody
    .selectAll(".dbrow")
    .data([1,2,3,4,5,6,7])
    .join(enter => enter.append("div").attr('class', 'dbrow'))
}

function updateDueBy() {
  if (processing) return
  if (opts.divDueby === null) return

  const nowstamp = bu.nowstamp(gol.timezone, gol.deadline, gol.asof)
  const nowday = bu.dayparse(nowstamp) / SID
  const mark = "&#10004;"
  let db = br.dueby(road, gol, 7)
  
  dbbody
    .selectAll(".dbrow")
    .selectAll(".dbcell")
    .data((row, i) => {const inf = duebylabel(i,nowday), del = db[i][1]; return [inf, [(del > 0 || gol.dir < 0)?bu.shn(del):mark,inf[1]], [bu.shn(db[i][2]),inf[1]]]})
    .join(enter=>enter.append("span").attr('class', 'dbcell'), update=>update)
    .html(d=>d[0])
    .style('color', d=>d[1])
}

/** Creates all graph matrix table components if a table DIV is provided. Called
 * once when the bgraph object is created. */
function createTable() {
  const div = opts.divTable
  if (div === null) return
  // First, remove all children from the div
  while (div.firstChild) {
    div.removeChild(div.firstChild)
  }
  const divelt = d3.select(div)
  const startelt = divelt.append("div").attr("class", "rtbstart")
  const bodyelt  = divelt.append("div").attr("class", "rtbmain")
  const goalelt  = divelt.append("div").attr("class", "rtbgoal")
  if (opts.tableHeight != 0) {
    bodyelt.style("max-height", opts.tableHeight+"px")
           .style("overflow-y", "auto")
  }
  const table = bodyelt.append("div").attr("class", "rtable")
  // This element is used to hold the Pikaday instance
  table.append("div").attr("id", "dpfloat").attr("class", "floating")
  // This helps figure out layout coords of the scrolled window top left
  topLeft = table.append("div").attr("id", "topleft")
    .style("position", "absolute").style("left", 0).style("top",0)
    .style("width", "1px").style("height", "1px")
    .attr("visibility","hidden")
  if (opts.reverseTable) {
    createGoalTable()
    createRoadTable()
    createStartTable()
  } else {
    createStartTable()
    createRoadTable()  
    createGoalTable()
  }
}

function roadChanged() {

  // If it were the case that tini was simply the first entry in the
  // road, update it for the edited road
  if (igoal.tini == iroad[0].end[0]) {
    gol.tini = road[0].end[0]
    gol.vini = road[0].end[1]
  }
  
  if (!settingRoad)
    // Explicitly set the road object for beebrain to force it to recompute
    // goal parameters
    bbr.setRoadObj(road)
  
  computePlotLimits(true)
  horindex = br.findSeg(road, gol.horizon)
  reloadBrush()
  updateRoadData()
  updateGraphData(true)
  updateContextData()
  updateTable()
  updateDueBy()
  if (typeof opts.onRoadChange === 'function') opts.onRoadChange.call()
}

// ---------------------------- Text Box Utilities -----------------------------

function createTextBox(x, y, text, col, textr=null) {
  let textobj = {}
  if (y < 20-plotpad.top)    y = 20 -plotpad.top
  if (y > plotbox.height-15) y = plotbox.height-15
  textobj.grp = focus.append('g')
  textobj.rect = textobj.grp.append('svg:rect')
    .attr('pointer-events', "none")
    .attr('fill',   opts.textBoxCol.bg)
    .style('stroke', col)
  textobj.text = textobj.grp.append('svg:text').attr('pointer-events', "none")
                                               .attr('text-anchor', 'middle')
  if (textr == null) {
    textobj.text.text(text).attr('class', 'svgtxt')
  } else {
    textobj.text.append("tspan").attr("x", 0).attr("dy", "0.6em")
                                .text(text).attr('class', 'svgtxt')
    for (let i = 0; i < textr.length; i++) {
      textobj.text.append("tspan").attr("dy", "1.2em")
        .attr("x", 0).text(textr[i])
        .attr("font-size", "0.7em")
    }
  }
  const bbox = textobj.text.node().getBBox()
  const margin = opts.textBox.margin
  textobj.rect.attr('x',      bbox.x - margin)
              .attr('y',      bbox.y - margin)
              .attr('width',  bbox.width + margin*2)
              .attr('height', bbox.height+ margin*2)

  if (x < bbox.width/2)               x = bbox.width/2
  if (x > plotbox.width-bbox.width/2) x = plotbox.width - bbox.width/2

  textobj.grp.attr('transform', 'translate('+(x+plotpad.left)+","
                                            +(y+plotpad.top)+")")
  return textobj
}

function updateTextBox( obj, x, y, text ) {
  if (!obj) {console.debug("updateTextBox: null input"); return }
  if (y < 20-plotpad.top)    y = 20 - plotpad.top
  if (y > plotbox.height-15) y = plotbox.height - 15
  obj.text.text(text)
  const bbox = obj.text.node().getBBox()
  const margin = opts.textBox.margin
  obj.rect.attr('x', bbox.x-margin)
          .attr('y', bbox.y-margin)
          .attr('width',  bbox.width +margin*2)
          .attr('height', bbox.height+margin*2)

  if (x < bbox.width/2)               x = bbox.width/2
  if (x > plotbox.width-bbox.width/2) x =plotbox.width - bbox.width/2
  obj.grp.attr('transform', 'translate('+(x+plotpad.left)+","
                                        +(y+plotpad.top)+")")
}

function rmTextBox( obj ) {
  if (!obj) { console.debug("updateTextBox: null input"); return }
  obj.grp.remove()
}

function hideTextBox( obj, hide ) {
  if (!obj) { console.debug("updateTextBox: null input"); return }
  obj.grp.attr("visibility", hide ? "hidden" : "visible")
}


// ----------------- Zoom and brush  related private functions -----------------

let ticks, tickType = 1, majorSkip = 7
/** Compute locations and labels for x-axis ticks corresponding to the entire
 * graph range for different zoom levels. These are stored in the "ticks"
 * member of the bgraph instance. Used later by the 
 * {@link bgraph~redrawXTicks redrawXTicks()} function for rendering. */
function computeXTicks() {
  const xr = xSc.domain()

  // The following make sure that the initial element of the tick values array
  // is at the proper boundary (day, month, year) depending on the tick types.
  const xt  = xr.map(e => e.getTime()/SMS)
  const xtm = xt.slice(); xtm[0] = bu.monthsnap(xtm[0])
  const xty = xt.slice(); xty[0] = bu.yearsnap(xty[0])
  const xrm = xtm.map(e => (new Date(e*SMS)))
  const xry = xty.map(e => (new Date(e*SMS)))

  // [0]: tick dates, [1]: tick text,
  ticks = []
  ticks.push([d3.utcDay .range(xr[0],   xr[1], 1),"%b %d"])
  ticks.push([d3.utcDay .range(xr[0],   xr[1], 2),"%b %d"])
  ticks.push([d3.utcWeek.range(xrm[0], xrm[1], 1),"%b %d"])
  ticks.push([d3.utcWeek.range(xrm[0], xrm[1], 2),"%b %d"])
  ticks.push([d3.utcMonth.every(1).range(xry[0], xry[1]),"%b %Y"])
  ticks.push([d3.utcMonth.every(2).range(xry[0], xry[1]),"%b %Y"])
  ticks.push([d3.utcMonth.every(3).range(xry[0], xry[1]),"%Y"])
  ticks.push([d3.utcYear .every(1).range(xry[0], xry[1]),"%Y"])
}

/** Redraw x-axis tick marks based on current x-axis range for the focus graph,
 * making "smart" decisions on what type of ticks to use. Tick mark types are
 * precomputed and stored in the "ticks" member by the 
 * {@link bgraph~computeXTicks computeXTicks()} function. */
function redrawXTicks() {
  //console.debug("redrawXTicks()");
  const xr = [nXSc.invert(0).getTime(), 
            nXSc.invert(plotbox.width).getTime()]

  const diff = ((xr[1] - xr[0])/(SMS*SID))
  // Adjust tick mark separation if the graph is too small
  if (opts.focusRect.width < 500) diff = diff*1.6
  else if (opts.focusRect.width < 550) diff = diff*1.4
  else if (opts.focusRect.width < 600) diff = diff*1.2
  // * tickType identifies the separation and text of ticks
  // * majorSkip is the number of ticks to skip for the annotated
  // "major" ticks. Remaining ticks are drawn as unlabeled small
  // indicators
  if (diff < 10)           { tickType = 0; majorSkip = 1 }
  else if (diff < 20)      { tickType = 0; majorSkip = 2 }
  else if (diff < 45)      { tickType = 0; majorSkip = 7 }
  else if (diff < 120)     { tickType = 1; majorSkip = 7 }
  else if (diff < 240)     { tickType = 2; majorSkip = 4 }
  else if (diff < 320)     { tickType = 4; majorSkip = 1 }
  else if (diff < 1.5*365) { tickType = 4; majorSkip = 2 } 
  else if (diff < 2.6*365) { tickType = 4; majorSkip = 3 } 
  else if (diff < 5*365)   { tickType = 5; majorSkip = 3 } 
  else if (diff < 10*365)  { tickType = 6; majorSkip = 4 } 
  else                     { tickType = 7; majorSkip = 1 }
  // Invisible ticks to the left of the graph
  const pt = ticks[tickType][0].filter((d)=>((d.getTime()<xr[0])))
  // Number of minor ticks in the partially visible 1st major tick interval
  const ind = (majorSkip - pt.length%majorSkip)%majorSkip
  // Filter tick values based on x axis range
  const tv = ticks[tickType][0].filter(
    (d)=>((d.getTime()>=xr[0]&&d.getTime()<=xr[1])))
  xAxis.tickValues(tv)
    .tickSize(6)
    .tickSizeOuter(0)
    .tickFormat(
      (d,i)=>d3.utcFormat((i%majorSkip==ind)?ticks[tickType][1]:"")(d))
  xAxisObj.call(xAxis.scale(nXSc));
  xAxisObj.selectAll("g").classed("minor", false)
  xAxisObj.selectAll("g")
    .filter((d, i)=>(i%majorSkip!=ind))
    .classed("minor", true)

  // Shift bottom tick marks upwards to ensure they point inwards
  xAxisObj.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(0,-5)")
  
  // Repeat the above process for the top X axis
  xGrid.tickValues(tv).tickSize(plotbox.width);
  xGridObj.call(xGrid.scale(nXSc));
  xGridObj.selectAll("g").classed("minor", false);
  xGridObj.selectAll("g")
    .filter( (d, i)=>(i%majorSkip!=ind))
    .classed("minor", true);
  xAxisT.tickValues(tv)
    .tickSize(6)
    .tickSizeOuter(0)
    .tickFormat(
      (d,i)=>d3.utcFormat((i%majorSkip==ind)?ticks[tickType][1]:"")(d))
  xAxisObjT.call(xAxisT.scale(nXSc));
  xAxisObjT.selectAll("g").classed("minor", false)
  xAxisObjT.selectAll("g")
    .filter((d, i)=>(i%majorSkip!=ind))
    .classed("minor", true)
  
  // Shift top tick marks downwards to ensure they point inwards
  xAxisObjT.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(0,6)")
}

/** Check the widths of y-axis labels and tick marks, resizing the graph
 * components if necessary */
function handleYAxisWidth() {
  //console.debug("curid="+curid+", hidden="+hidden)

  // Checking for the "hidden" state ensures that getBBox() is not
  // called for invisible components in the DOM.
  if (opts.divGraph != null && !hidden) {
    yAxisLabel.text(gol.yaxis)
    if (gol.hidey && !opts.roadEditor) {
      //yAxisObj.selectAll( "text").remove()
      //yAxisObjR.selectAll("text").remove()
      yAxisObj.selectAll( "text").attr('display', 'none')
      yAxisObjR.selectAll("text").attr('display', 'none')
    } else {
      yAxisObj.selectAll( "text").attr('display', null)
      yAxisObjR.selectAll("text").attr('display', null)
    }
    
    const bbox = yAxisObj.node().getBBox()
    // Adjust the graph size and axes if the y axis tick
    // width has changed by a nontrivial amount. This
    // causes a bit jumpy behavior when dragging the brush
    // across the boundary of width change, but that seems
    // to not be too bad a problem.
    if (abs(bbox.width-yaxisw) > 5) {
      yaxisw = floor(bbox.width)
      resizeGraph()
    }
  }
}

/** Adjust scale and range for y-axis based on current range of the y-axis. The
 * y-axis range depends on the graph configuration, including whether it's a
 * headless graph for a screenshot, an interactive graph, or the editor. */
function adjustYScale() {
  const  xrange = [nXSc.invert(0), 
                nXSc.invert(plotbox.width)]
  let yrange
  if (opts.headless) {
    // Headless graphs should match previous pybrain range
    const va = gol.vmin  - PRAF*(gol.vmax-gol.vmin)
    const vb = gol.vmax  + PRAF*(gol.vmax-gol.vmin)
    yrange = [vb, va]
  } else {
    const margin = abs(PRAF*(gol.vmax-gol.vmin))

    // Compute range in unixtime
    const xtimes = xrange.map(d => floor(d.getTime()/SMS))
    // Compute Y axis extent of the edited road in range
    const re = roadExtentPartial(road,xtimes[0],xtimes[1],false)
    re.yMin -= margin
    re.yMax += margin
    let ae
    if (opts.roadEditor) {
      // Compute Y axis extent of the initial road in range
      const ore = roadExtentPartial(iroad,xtimes[0],xtimes[1],false)
      ore.yMin -= margin
      ore.yMax += margin
      ae = mergeExtents(re, ore)
    } else ae = re
    
    // Compute Y axis extent of datapoints in range
    const de = dataExtentPartial((gol.plotall&&!opts.roadEditor)
                                ? alldata : data,
                                xtimes[0],xtimes[1],false)
    if (de != null) ae = mergeExtents(ae, de)
    const p
          = (opts.roadEditor)?{xmin:0.0,xmax:0.0,ymin:0.05,ymax:0.05}:{xmin:0.0,xmax:0.0,ymin:0.02,ymax:0.02}
    enlargeExtent(ae, p)
    if ((ae.yMax - ae.yMin) < 2*margin) {
      ae.yMax += margin
      ae.yMin -= margin
    }
    yrange = [ae.yMax, ae.yMin]
  }
  // Enlarge yrange in case it is "vanishingly" small. We make the
  // criteria dependent on the y axis max value to handle goals with
  // large y axis values as well. The tolerance should be tuned if
  // anomalies are observed.
  const ytol = max(1e-5, min(1,1e-3*yrange[0]))
  if ((yrange[0] - yrange[1]) < ytol) {
    yrange[0] = yrange[0] + ytol
    yrange[1] = yrange[1] - ytol
  }
  // Modify the scale object for the entire Y range to focus on
  // the desired range
  const newtr = d3.zoomIdentity
        .scale(plotbox.height/(ySc(yrange[1])-ySc(yrange[0])))
        .translate(0, -ySc(yrange[0]))
  nYSc = newtr.rescaleY(ySc)
  yAxisObj.call(yAxis.scale(nYSc))
  yAxisObjR.call(yAxisR.scale(nYSc))

  // Resize brush if dynamic y limits are beyond graph limits
  if (yrange[0] > gol.yMax) gol.yMax = yrange[0]
  if (yrange[1] < gol.yMin) gol.yMin = yrange[1]
  resizeContext()

  // Rescale the focus rectange to show area being focused.
  const sx = xrange.map( x => xScB(x))
  const sy = yrange.map( y => yScB(y))
  focusrect
    .attr("x", sx[0]+1).attr("width",  max(0, sx[1]-sx[0]-2))
    .attr("y", sy[0]+1).attr("height", max(0, sy[1]-sy[0]-2))
}

/** Update context graph X and Y axis scales to consider newest graph ranges */
function resizeContext() {
  if (opts.divGraph == null) return
  xScB.domain([new Date(min(gol.tmin, gol.xMin)*SMS), 
               new Date(max(gol.tmax, gol.xMax)*SMS)])
  xAxisObjB.call(xAxisB.scale(xScB))
  yScB.domain([gol.yMin, gol.yMax])
}

/** Update brush rectangle and brush box in the context graph to cover the
 * updated X range */
function resizeBrush() {
  if (opts.divGraph == null) return
  const limits = [xScB(nXSc.invert(0)), 
                xScB(nXSc.invert(plotbox.width))]
  //console.debug("limits: "+limits);
  if (limits[0] < 0) limits[0] = 0
  if (limits[1] > brushbox.width) limits[1] = brushbox.width
  brush.call(brushObj.move, limits)
}

/** Update context graph by recomputing its limits & resizing the brush in it */
function reloadBrush() { resizeContext(); resizeBrush() }

/** Gets called by d3.zoom when there has been a zoom event
 * associated with the focus graph */
function zoomed() {
  //console.debug("id="+curid+", zoomed()")
  //console.trace()
  if (road.length == 0) return
  // Prevent recursive calls if this was initiated by a brush motion, resulting
  // in an updated zoom in the focus graph
  if (d3.event && d3.event.sourceEvent 
               && d3.event.sourceEvent.type === "brush") return

  // Inject the current transform into the plot element
  const tr = d3.zoomTransform(zoomarea.node())
  if (tr == null) return
  
  nXSc = tr.rescaleX(xSc)
  redrawXTicks()
  adjustYScale()
  // Shift Y axis tick marks to make them point inwards
  yAxisObj.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(6,0)")
  yAxisObjR.selectAll("g").selectAll(".tick line")
    .attr("transform", "translate(-5,0)")
  handleYAxisWidth()

  resizeBrush()
  updateGraphData()
  return
}

/** Called by d3.brush whenever user modifies the brush on the context graph */
function brushed() {
  //console.debug("id="+curid+", brushed()")
  //console.trace()
  if (road.length == 0) return
  // Prevent recursive calls in case the change in the brush was triggered by a
  // zoom event
  if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return
  const s = d3.event.selection || xScB.range()
  
  nXSc.domain(s.map(xScB.invert, xScB))
  redrawXTicks()
  adjustYScale()
  handleYAxisWidth()
  
  zoomarea.call(axisZoom.transform, d3.zoomIdentity
                .scale(brushbox.width / (s[1] - s[0]))
                .translate(-s[0], 0))
  updateGraphData()
}

/** Update both the context and focus graphs to include default zoom range */
function zoomDefault() {
  if (opts.divGraph == null) return
  //console.debug("id="+curid+", zoomDefault()")
  const ta = gol.tmin - PRAF*(gol.tmax-gol.tmin)
  const tb = gol.tmax + PRAF*(gol.tmax-gol.tmin)
  const newdom = [new Date(ta*SMS),new Date(tb*SMS)]
  nXSc.domain(newdom)
  const s = newdom.map(xScB)
  //console.debug(s)
  redrawXTicks()
  adjustYScale()
  zoomarea.call(axisZoom.transform, d3.zoomIdentity
                .scale(brushbox.width / (s[1] - s[0]))
                .translate(-s[0], 0))
}

/** Update both the context and focus graphs to zoom out, including the entire
 * graph range */
function zoomAll( ) {
  //console.debug("id="+curid+", zoomAll()")
  if (opts.divGraph == null) return
  computePlotLimits(false)
  // Redefine the unzoomed X and Y scales in case graph range was redefined
  xSc.domain([new Date(min(gol.tmin, gol.xMin)*SMS), 
              new Date(max(gol.tmax, gol.xMax)*SMS)])
  computeXTicks()
  ySc.domain([gol.yMin, gol.yMax])
  nXSc = xSc
  nYSc = ySc
  resizeContext()
  zoomarea.call(axisZoom.transform, d3.zoomIdentity)
  // Relocate zoom buttons based on road yaw
  if (gol.dir > 0) {
    zoomin.attr( "transform", zoombtntr.botin)
    zoomout.attr("transform", zoombtntr.botout)
  } else {
    zoomin.attr( "transform", zoombtntr.topin)
    zoomout.attr("transform", zoombtntr.topout)
  }
  reloadBrush()
}

// -------------------------- Undo/Redo functionality --------------------------

function clearUndoBuffer() {
  //console.debug("clearUndoBuffer()")
  undoBuffer = []
  redoBuffer = []
}

function redoLastEdit() {
  //console.debug("redoLastEdit: UndoBuffer has "+undoBuffer.length+" entries")
  if (redoBuffer.length == 0) return
  pushUndoState(true)
  road = redoBuffer.pop()
  roadChanged()
  return
}

function undoLastEdit() {
  //console.debug("undoLastEdit: UndoBuffer has "+undoBuffer.length+" entries")
  if (undoBuffer.length == 0) return
  if (undoBuffer.length == 0 || 
      !br.sameRoads(undoBuffer[undoBuffer.length-1], road)) {
    redoBuffer.push(road)
  }
  road = undoBuffer.pop()
  bbr.setRoadObj(road) // Since popped version is a copy, must inform beebrain
  roadChanged()
  return
}

function pushUndoState(fromredo = false) {
  //console.debug("pushUndoState: UndoBuffer has "+undoBuffer.length+" entries")
  if (undoBuffer.length == 0 || 
      !br.sameRoads(undoBuffer[undoBuffer.length-1], road)) {
    undoBuffer.push(br.copyRoad(road))
    if (!fromredo) { redoBuffer = [] }
  }
}

// Determine whether given road is valid (ie, clear of the pinkzone)
// TODO: Must rethink this check, probably a general segment intersection
// algorithm will be best
function isRoadValid(rd) {
  const ir = iroad
  const EPS = 0.000001 // dang floating point comparisons
  
  const now = gol.asof
  const hor = gol.horizon
  // Check left/right boundaries of the pinkzone. This should handle the case
  // when there are no kinks within the horizon.
  if (gol.yaw*br.rdf(rd, now) < gol.yaw*br.rdf(ir, now) - EPS) return false
  if (gol.yaw*br.rdf(rd, hor) < gol.yaw*br.rdf(ir, hor) - EPS) return false
  // Iterate through and check current road points in the pink range
  const rd_i1 = br.findSeg(rd, now) // was dir=-1 but don't think it matters
  const rd_i2 = br.findSeg(rd, hor) // was dir=+1 but don't think it matters
  for (let i = rd_i1; i < rd_i2; i++) {
    if (gol.yaw*br.rdf(rd, rd[i].end[0]) < 
        gol.yaw*br.rdf(ir, rd[i].end[0]) - EPS) return false
  }
  // Iterate through and check old road points in the pink range
  const ir_i1 = br.findSeg(ir, now) // was dir=-1 but don't think it matters
  const ir_i2 = br.findSeg(ir, hor) // was dir=+1 but don't think it matters
  for (let i = ir_i1; i < ir_i2; i++) {
    if (gol.yaw*br.rdf(rd, ir[i].end[0]) < 
        gol.yaw*br.rdf(ir, ir[i].end[0]) - EPS) return false
  }
  return true
}


function mergeExtents(ext1, ext2) {
  let ne = {}
  ne.xMin = min(ext1.xMin, ext2.xMin)
  ne.xMax = max(ext1.xMax, ext2.xMax)
  ne.yMin = min(ext1.yMin, ext2.yMin)
  ne.yMax = max(ext1.yMax, ext2.yMax)
  return ne
}

function enlargeExtent(extent, p) {
  let xdiff = extent.xMax - extent.xMin
  if (xdiff < 1e-7) xdiff = 1e-7
  let ydiff = extent.yMax - extent.yMin
  if (ydiff < 1e-7) ydiff = 1e-7

  extent.xMin = extent.xMin - p.xmin*xdiff
  extent.xMax = extent.xMax + p.xmax*xdiff
  extent.yMin = extent.yMin - p.ymin*ydiff
  extent.yMax = extent.yMax + p.ymax*ydiff
}

function roadExtent(rd, extend = true) {
  let extent = {}
  // Compute new limits for the current data
  extent.xMin = bu.arrMin(rd.map(d=>d.end[0]))
  extent.xMax = bu.arrMax(rd.map(d=>d.sta[0]))
  extent.yMin = bu.arrMin(rd.map(d=>d.sta[1]))
  extent.yMax = bu.arrMax(rd.map(d=>d.sta[1]))
  // Extend limits by 5% so everything is visible
  const p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (extend) enlargeExtent(extent, p)
  return extent
}

function dataExtentPartial(data, xmin, xmax, extend = false) {
  let extent = {}
  let nd = data.filter(d => (d[0] > xmin && d[0] < xmax))
  if (nd.length == 0) {
    // no points are in range, find enclosing two
    let ind = -1
    for (let i = 0; i < data.length-1; i++) {
      if (data[i][0]<=xmin && data[i+1][0]>=xmax) { ind = i; break }
    }
    if (ind > 0) nd = data.slice(ind, ind+1)
  }
  // Inform caller if no data points are in between the supplied range.
  if (nd.length == 0) return null

  // Compute new limits for the current data
  extent.xMin = bu.arrMin(nd.map(d=>d[0]))
  extent.xMax = bu.arrMax(nd.map(d=>d[0]))
  extent.yMin = bu.arrMin(nd.map(d=>d[1]))
  extent.yMax = bu.arrMax(nd.map(d=>d[1]))     
  if (bbr.flad != null && bbr.flad[0] <= xmax && bbr.flad[0] >= xmin) {
    const pprv = bbr.flad[1] + br.ppr(road, gol, gol.asof)
    extent.yMin = min(extent.yMin, pprv) // Make room for the
    extent.yMax = max(extent.yMax, pprv) // ghosty PPR datapoint.
  }
  // Extend limits by 5% so everything is visible
  const p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (extend) enlargeExtent(extent, p)
  return extent
}

function roadExtentPartial( rd, xmin, xmax, extend = false ) {
  let extent = {}
  // Compute new limits for the current data
  extent.xMin = xmin
  extent.xMax = xmax
  extent.yMin = bu.arrMin(rd.map(function(d) { 
    return (d.sta[0]<xmin||d.sta[0]>xmax)?Infinity:d.sta[1] }))
  extent.yMax = bu.arrMax(rd.map(function(d) { 
    return (d.sta[0]<xmin||d.sta[0]>xmax)?-Infinity:d.sta[1] }))
  extent.yMin = bu.arrMin([extent.yMin, br.rdf(rd,xmin), br.rdf(rd,xmax)])
  extent.yMax = bu.arrMax([extent.yMax, br.rdf(rd,xmin), br.rdf(rd,xmax)])
  // Extend limits by 5% so everything is visible
  const p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (extend) enlargeExtent(extent, p)
  return extent
}

// Convert time of day given as seconds from midnight to a string like "3am"
function TOD(ds) {
  return moment.unix(ds).utc().format("h:mma").replace(":00", "")
}

// Convert unixtime to a day-of-the-week string like "Wed"
function DOW(t) { return moment.unix(t).utc().format("ddd") }

// Set watermark (waterbuf) to number of safe days if not given explicitly
function setWatermark() {
  if (gol.waterbuf0 !== null) return // it was set as a Beebrain in-param
  
  // This seems bad to set all these goal fields as a side effect here!
  gol.safebuf = br.dtd(road, gol, gol.tcur, gol.vcur)
  gol.tluz = min(gol.tcur + gol.safebuf*SID, gol.tfin + SID, bu.BDUSK)
  //gol.tluz = gol.tcur + gol.safebuf*SID
  if (gol.tluz > gol.tfin) gol.tluz = bu.BDUSK // TODO see thing in procParams()
  gol.loser = br.redyest(road, gol, gol.tcur) // needs iso here; is that fine?
  const del = bu.chop(gol.yaw*(gol.vcur - gol.vfin)) // delta from goal 
  const yay = gol.asof === gol.tfin && del >= 0 // we're on goal date & made it
  const eke = gol.asof === gol.tfin && del < 0  // we're on goal date & not done
  
  gol.waterbuf = 
    gol.loser           ? ':('                  : // show skull & crossbones
    gol.asof > gol.tfin ? 'fin'                 : // past tfin? shouldn't happen
    yay                 ? ':)'                  : // show happyface
    eke                 ? 'eke'                 : // eking by on last day
    gol.tluz > gol.tfin ? 'inf'                 : // coasting till tfin
    gol.safebuf <= 0    ? TOD(gol.deadline)+'!' : // show deadline time
    gol.safebuf < 7     ? DOW(gol.tluz)         : // show deadline day
    gol.safebuf < 365   ? gol.safebuf+'d'       : // show number of safe days
    gol.safebuf <= 999  ? gol.safebuf+'d'       : // way too much buffer
    gol.safebuf > 999   ? '>999d'               : // quasi-infinite buffer
                          '???'                   // can't actually happen
}

function computePlotLimits(adjustZoom = true) {
  if (road.length == 0) return

  const now = gol.asof
  const maxx = bu.daysnap(min(now+opts.maxFutureDays*SID, 
                                 road[road.length-1].sta[0]))
  const cur = roadExtentPartial(road, road[0].end[0], maxx, false)
  let ne
  if (opts.roadEditor) {
    let old = roadExtentPartial(iroad,road[0].end[0],maxx,false)
    ne = mergeExtents(cur, old)
  } else ne = cur

  const d = dataExtentPartial(gol.plotall&&!opts.roadEditor ? alldata : data, 
                            road[0].end[0], data[data.length-1][0], false)

  if (d != null) ne = mergeExtents(ne, d)
  if (bbr.fuda.length != 0) {
    const df = dataExtentPartial(bbr.fuda, road[0].end[0], maxx, false)
    if (df != null) ne = mergeExtents(ne, df)
  }
  const p = {xmin:0.10, xmax:0.10, ymin:0.10, ymax:0.10}
  if (!opts.roadEditor) {
    // The editor needs more of the time range visible for editing purposes
    p.xmin = 0.02
    p.xmax = 0.02
  }
  enlargeExtent(ne, p)

  gol.xMin = bu.daysnap(ne.xMin)
  gol.xMax = bu.daysnap(ne.xMax)
  gol.yMin = ne.yMin
  gol.yMax = ne.yMax

  if (adjustZoom && opts.divGraph != null) {
    const xrange = [nXSc.invert(0), 
                  nXSc.invert(plotbox.width)]
    const yrange = [nYSc.invert(0), 
                  nYSc.invert(plotbox.height)]
    xSc.domain([new Date(min(gol.tmin, gol.xMin)*SMS), 
                new Date(max(gol.tmax, gol.xMax)*SMS)])
    computeXTicks()
    ySc.domain([gol.yMin, gol.yMax])
    const newtr = d3.zoomIdentity.scale(plotbox.width/(xSc(xrange[1]) 
                                                   - xSc(xrange[0])))
        .translate(-xSc(xrange[0]), 0)
    zoomarea.call(axisZoom.transform, newtr)
  }
}

// Function to generate samples for the Butterworth filter
function griddlefilt(a, b) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 40, 2000)))
}

// Function to generate samples for the Butterworth filter
function griddle(a, b, maxcnt = 6000) {
  return bu.linspace(a, b, floor(bu.clip((b-a)/(SID+1), 
                                      min(300, plotbox.width/8),
                                      maxcnt)))
}

const stats_timeid = `bgraph(${curid}): Goal stats`
const graph_timeid = `bgraph(${curid}): Goal graph`
// Recreates the road array from the "rawknots" array, which includes only
// timestamp,value pairs

/**Load goal details from the supplied JSON input and populate the graph and
   graph matrix table with necessary components based on initially supplied
   options.
   @param {Object} json JSON object with the contents of a BB file, directly fed
   to a {@link beebrain} object instance. */
function loadGoal(json, timing = true) {
  //console.debug("id="+curid+", loadGoal()->"+json.params.yoog)
  if (!('params' in json) || !('data' in json)) {
    throw new Error("loadGoal: JSON input lacks params or data")
  }
  clearUndoBuffer()

  // Disable various graph component updates until graph axes are in
  // their final state and ranges
  processing = true
  
  // Create beebrain processor
  let suffix = (json.params.yoog) ? " ("+json.params.yoog+")" : ""
  if (timing) { console.time(stats_timeid+suffix) }
  bbr = new bb(json)
  gol = bbr.gol
  if (opts.divJSON) {
    if (opts.headless)
      opts.divJSON.innerText = JSON.stringify(bbr.getStats())
    else
      opts.divJSON.innerText = JSON.stringify(bbr.getStats(), null, 4)
  }
  if (timing) { console.timeEnd(stats_timeid+suffix) }

  if (gol.error != "") {
    console.log("Beebrain error: "+ bbr.gol.error)
    lastError = ErrType.BBERROR
    const errors = bbr.gol.error.split("\\n")
    showOverlay( 
      (["The following errors prevented us from generating "+bbr.gol.yoog,
        "(We've pinged Beeminder support to come help fix things up here!)",
        ""]).concat(errors), sh/30, null)
    resetGoal()
    processing = false
    return
  }

  if (opts.noGraph) {
    showOverlay( (["Beebrain was called with 'NOGRAPH_*' as the slug",
                   "so no graph or thumbnail was generated, just this",
                   "static placeholder!"]), sh/30, null)
    resetGoal()
    processing = false
    return
  }
  
  road    = bbr.roads
  iroad   = br.copyRoad(road)
  data    = bbr.data
  rawdata = bu.deepcopy(json.data)
  igoal   = bu.deepcopy(gol)
  alldata = bbr.alldata

  // Extract limited data
  if (opts.maxDataDays < 0) {
    dataf = data.slice()
    alldataf = alldata.slice()
  } else {
    dataf = data.filter(function(e){
      return e[0]>(gol.asof-opts.maxDataDays*SID)})
    alldataf = alldata.filter(function(e){
      return e[0]>(gol.asof-opts.maxDataDays*SID)})
  }

  if (opts.divGraph) {
    if (!opts.roadEditor && gol.stathead)
      stathead.text(gol.graphsum)
    else
      stathead.text("")
  }
  if (timing) { console.time(graph_timeid+suffix) }
  
  // Finally, wrap up with graph related initialization
  updateRoadData()
  zoomAll()
  zoomDefault()

  // Re-enable updates for graph components. Next call to resizeGraph will
  // redraw all of these components
  processing = false

  updateTable()
  updateDueBy()
  resetDataTable()

  updateContextData()

  // This next call ensures that stathead and other new graph
  // properties are properly reflected in the new graph dimensions
  resizeGraph()
    
  updateTableTitles()
  if (typeof opts.onRoadChange === 'function') opts.onRoadChange.call()
  if (timing) { console.timeEnd(graph_timeid+suffix) }
}

async function loadGoalFromURL( url, callback = null ) {
  //console.debug( "loadGoalFromURL: Loading: "+url );
  if (url == "" || loading) return
  loading = true
  if (!opts.headless) showOverlay( ["loading..."], sh/10 )
  const resp = await bu.loadJSON( url )
  if (resp != null) {
    if (!opts.headless) removeOverlay()
    if ('errstring' in resp) {
      throw new Error("loadGoalFromURL: BB file has errors: "+resp.errstring)
    }
    loadGoal( resp )
  } else {
    if (lastError != null) showOverlay( [ErrMsgs[lastError]])
    else showOverlay(["Could not load goal file."])
    if (!opts.headless) setTimeout(removeOverlay, 1500)
    if (typeof opts.onError === 'function') {
      opts.onError.call()
    }
  } 
  loading = false
}

function setSafeDays( days ) {
  if (road.length == 0) {
    console.log("bgraph("+curid+"):setSafeDays(), road is empty!")
    return
  }
  //console.debug("setSafeDays()");
  let curdtd = br.dtd(road, gol, gol.tcur, gol.vcur)
  const now = gol.asof
  if (days < 0) days = 0
  // Look into the future to see the road value to ratchet to
  const daydiff = curdtd - (days - 1) - 1
  if (daydiff <= 0) return
  const futureDate = gol.asof + daydiff*SID
  const ratchetValue = br.rdf(road, futureDate)

  // Find or add two new dots at asof
  // We only allow the first step to record undo info.
  let first = -1, i
  for (i = 1; i < road.length; i++) {
    if (road[i].sta[0] === now) {
      first = i-1; break
    }
  }
  let added = false;
  if (first < 0) {addNewDot(now);added = true}
  let second
  if (i+1 < road.length && road[i+1].sta[0] === now)
    second = i
  else {
    second = addNewDot(now, ratchetValue)
    if (added) {undoBuffer.pop(); added = true}
  }
  //changeDotValue( second, ratchetValue, false )
  //if (added) { undoBuffer.pop(); added = true }

  roadChanged()
}

// Add a new dot to the supplied x value, with the y value either explicitly
// specified or computed from the corresponding y value.
function addNewDot(x, y = null) {
  let found = br.findSeg(road, x)
  if (found >= 0) {
    let s = {}
    let newx = bu.daysnap(x+SID/2)
    let newy = y
    if (y == null) {
      newy = road[found].sta[1] + road[found].slope*(newx - road[found].sta[0])
    }
    pushUndoState()
    s.sta = [newx, newy]
    if (found == 0) {
      // First segment splitted
      s.end = road[found+1].sta.slice()
      if (y != null) {
        s.end[1] = s.sta[1] + road[found].slope*(s.end[0]-newx)
      }
      road[found].end = [newx, newy]
    } else {
      if (found == road.length-1) {
        // Last segment splitted
        s.end = road[found].end.slice()
        s.end[1] = newy
      } else {
        s.end = road[found+1].sta.slice()
        if (y != null && opts.keepSlopes) {
          s.end[1] = s.sta[1] + road[found].slope*(s.end[0]-newx)
        }
      }
      road[found].end = [newx, newy];
      road[found].slope = br.segSlope(road[found]);
      // If the adjusted segment is vertical, switch its auto field to SLOPE
      if (road[found].sta[0] == road[found].end[0])
        road[found].auto = br.RP.SLOPE
    }
    s.slope = br.segSlope(s)
    s.auto  = br.RP.VALUE
    road.splice(found+1, 0, s)
    br.fixRoadArray(road, opts.keepSlopes ? br.RP.VALUE : br.RP.SLOPE, false)
    roadChanged()
    let elt = d3.select(opts.divTable).select(".roadrow [name=endvalue"+(found+1)+"]")
    if (!elt.empty()) autoScroll(elt, false)
  }
  return found;
}

function addNewKnot(kind) {
  if (kind < road.length-1) {
    let newt = (road[kind].sta[0] + road[kind+1].sta[0])/2
    if (newt - road[kind].sta[0] > 30*SID) newt = road[kind].sta[0]+30*SID
    addNewDot(newt)
  } else {
    addNewDot(road[kind].sta[0] + 7*SID)
  }
}

function removeKnot(kind, fromtable) {
  pushUndoState()

  const oldslope = road[kind].slope
  road.splice(kind, 1)
  if (!fromtable && opts.keepSlopes && !isNaN(oldslope)) road[kind].slope = oldslope
  br.fixRoadArray(road, opts.keepSlopes && !fromtable ? br.RP.VALUE : br.RP.SLOPE, fromtable)

  roadChanged()
}

// ---------------------- Drag related utility functions -----------------------

let knottext = null, dottext = null, slopetext = null

function createDragInfo(pt, slope = undefined) {
  let ptx = nXSc(bu.daysnap(pt[0])*SMS)
  let pty = pt[1]
  knotdate = moment.unix(pt[0]).utc()
  knottext = createTextBox(ptx, plotbox.height-15, 
                           knotdate.format('YYYY-MM-DD')
                           + " ("+knotdate.format("ddd")+")",
                           opts.textBoxCol.stroke)
  dottext = createTextBox(ptx, nYSc(pty)-15, 
                          bu.shn(pt[1]), opts.textBoxCol.stroke)
  if (slope != undefined) {
    const slopex = nXSc(bu.daysnap(slope[0])*SMS)
    const slopey = nYSc(slope[1])
    slopetext = createTextBox(slopex,slopey, 
                              "s:"+bu.shn(slope[2]),
                              opts.textBoxCol.stroke)
    if (ptx - slopex < 50) hideTextBox(slopetext, true)
  }
}
function updateDragInfo(pt, slope) {
  const ptx = bu.daysnap(pt[0])
  const pty = pt[1]
  knotdate = moment.unix(ptx).utc()
  updateTextBox(knottext, nXSc(ptx*SMS), plotbox.height-15, 
                knotdate.format('YYYY-MM-DD') + " ("+knotdate.format("ddd")+")")
  updateTextBox(dottext, nXSc(ptx*SMS), nYSc(pty)-15, bu.shn(pt[1]))
  if (slope != undefined) {
    const slopex = bu.daysnap(slope[0])
    const slopey = slope[1]
    updateTextBox(slopetext, nXSc(slopex*SMS), nYSc(slopey), 
                  "s:"+bu.shn(slope[2]))
  }
}
function removeDragInfo( ) {
  if (knottext != null) rmTextBox(knottext)
  knottext = null
  if (dottext != null) rmTextBox(dottext)
  dottext = null
  if (slopetext != null) rmTextBox(slopetext)
  slopetext = null
}

function updateDragPositions(kind, updateKnots) {
  const rd = road
  const el = d3.select(opts.divGraph)
  for (let ii = kind; ii < rd.length; ii++) {
    el.select("[name=dot"    +ii+"]").attr("cx", r1(nXSc(rd[ii].end[0]*SMS)))
                                     .attr("cy", r1(nYSc(rd[ii].end[1])))
    el.select("[name=ctxdot" +ii+"]").attr("cx", r1(xScB(rd[ii].end[0]*SMS)))
                                     .attr("cy", r1(yScB(rd[ii].end[1])))
    el.select("[name=road"   +ii+"]").attr("x1", r1(nXSc(rd[ii].sta[0]*SMS)))
                                     .attr("y1", r1(nYSc(rd[ii].sta[1])))
                                     .attr("x2", r1(nXSc(rd[ii].end[0]*SMS)))
                                     .attr("y2", r1(nYSc(rd[ii].end[1])))
    el.select("[name=ctxroad"+ii+"]").attr("x1", r1(xScB(rd[ii].sta[0]*SMS)))
                                     .attr("y1", r1(yScB(rd[ii].sta[1])))
                                     .attr("x2", r1(xScB(rd[ii].end[0]*SMS)))
                                     .attr("y2", r1(yScB(rd[ii].end[1])))
    if (updateKnots) {
      el.select("[name=knot" +ii+"]").attr("x1", r1(nXSc(rd[ii].end[0]*SMS)))
                                     .attr("x2", r1(nXSc(rd[ii].end[0]*SMS)))
      el.select("[name=remove"+ii+"]")
        .attr("transform", 
              d => ("translate("+(nXSc(d.end[0]*SMS)+plotpad.left-8)
                    +","+(plotpad.top-20)+") scale(0.6,0.6)"))
    }
    el.select("[name=enddate" +ii+"]").text(bu.dayify(rd[ii].end[0], '-'))
    el.select("[name=endvalue"+ii+"]").text(bu.shn(rd[ii].end[1]))
    el.select("[name=slope"   +ii+"]").text(bu.shn(rd[ii].slope*gol.siru))
  }

  if (opts.tableUpdateOnDrag) updateTableValues()
  if (opts.duebyUpdateOnDrag) updateDueBy()
  updateRoadData()
  updateRoadValidity()
  updateWatermark()
  updateBullseye()
  updateContextBullseye()
  updateDataPoints()
  updateMovingAv()
  updateYBHP()
  updateGuidelines()
  updatePinkRegion()
  updateMaxFluxline()
  updateStdFluxline()
}

// --------------- Functions related to selection of components ----------------

let selection  = null
let selectType = null
let selectelt  = null

function selectKnot(kind, scroll = true) {
  if (opts.divGraph == null) return
  highlightDate( kind, true, scroll )
  selection = kind
  selectType = br.RP.DATE
  d3.select("[name=knot"+kind+"]").attr("stroke-width", r3(opts.roadKnot.width))
  const x = nXSc(road[kind].end[0]*SMS)
  selectelt = gKnots.append("svg:line")
    .attr("class",          "selectedknot")
    .attr("pointer-events", "none")
    .attr("x1",             x)
    .attr("x2",             x)
    .attr("y1",             0)
    .attr("y2",             plotbox.height)
    .attr("stroke",         opts.roadKnotCol.selected)
    .attr("stroke-opacity", 0.9)
    .attr("stroke-width",   r3(opts.roadKnot.width+4)).lower()
}
function unselectKnot(kind) {
  highlightDate(kind, false)
  d3.select("[name=knot"+kind+"]").attr("stroke",       opts.roadKnotCol.dflt)
                                  .attr("stroke-width", r3(opts.roadKnot.width))
}
function selectDot(kind, scroll=true) {
  if (opts.divGraph == null) return
  highlightValue(kind, true, scroll)
  selection = kind
  selectType = br.RP.VALUE
  d3.select("[name=dot"+kind+"]").attr("r", r3(opts.roadDot.size))
  selectelt = gDots.append("svg:circle")
    .attr("class",          "selecteddot")
    .attr("pointer-events", "none")
    .attr("cx",              r1(nXSc(road[kind].end[0]*SMS)))
    .attr("cy",              r1(nYSc(road[kind].end[1])))
    .attr("fill",            opts.roadDotCol.selected)
    .attr("fill-opacity",    0.6)
    .attr("r",               r3(opts.roadDot.size+4))
    .attr("stroke",          "none").lower()
}
function unselectDot(kind) {
  highlightValue(kind, false)
  d3.select("[name=dot"+kind+"]").attr("fill", opts.roadDotCol.editable)
                                 .attr("r",    r3(opts.roadDot.size))
}
function selectRoad(kind, scroll = true) {
  if (opts.divGraph == null) return
  highlightSlope(kind, true, scroll)
  selection = kind
  selectType = br.RP.SLOPE
  d3.select("[name=road"+kind+"]")
    .attr("shape-rendering", "geometricPrecision") // crispEdges
    .attr("stroke-width",    (opts.roadLine.width,3)) // ???????????????????????
  selectelt = gRoads.append("svg:line")
    .attr("class",           "selectedroad")
    .attr("shape-rendering", "geometricPrecision") // crispEdges
    .attr("pointer-events",  "none")
    .attr("x1",              nXSc(road[kind].sta[0]*SMS))
    .attr("x2",              nXSc(road[kind].end[0]*SMS))
    .attr("y1",              nYSc(road[kind].sta[1]))
    .attr("y2",              nYSc(road[kind].end[1]))
    .attr("stroke",          opts.roadKnotCol.selected)
    .attr("stroke-opacity",  0.9)
    .attr("stroke-width",    r3(opts.roadLine.width+4)).lower()
}
function unselectRoad(kind) {
  highlightSlope(kind, false)
  const lineColor = isRoadValid(road) ? opts.roadLineCol.valid 
                                    : opts.roadLineCol.invalid
  d3.select("[name=road"+kind+"]")
    .style("stroke",      lineColor)
    .attr("stroke-width", r3(opts.roadLine.width))
}
function unselect() {
  selection = null
  selectType = null
  if (selectelt != null) { selectelt.remove(); selectelt=null }
}
function clearSelection() {
  //console.debug("clearSelection()")
  if (selection == null) return
  if (selectType == br.RP.DATE) unselectKnot(selection)
  else if (selectType == br.RP.VALUE) unselectDot(selection)
  else if (selectType == br.RP.SLOPE) unselectRoad(selection)
  removeDragInfo()
  unselect()
}

// --------------------- Functions for manipulating knots ----------------------

let roadsave, knotind, knotdate, prevslopes

let editingKnot = false
function knotDragStarted(d,i) {
  d3.event.sourceEvent.stopPropagation()
  editingKnot = true
  pushUndoState()
  var kind = Number(this.id)
  roadsave = br.copyRoad(road)
  if (selection == null) {
    selectKnot(kind)
  } else if (selection != null 
             && selection == kind && selectType == br.RP.DATE) {
    clearSelection()
  } else {
    clearSelection()
    selectKnot(kind)
  }
  createDragInfo(d.end)
  knottext.grp.raise()
  // Store initial slopes to the left & right to prevent collapsed segment
  // issues
  prevslopes = []
  prevslopes[0] = road[kind].slope
  prevslopes[1] = road[kind+1].slope

}

function knotDragged(d,i) {
  unselect()
  // event coordinates are pre-scaled, so use normal scale
  let x = bu.daysnap(nXSc.invert(d3.event.x)/SMS)
  const kind = Number(this.id)
  const rd = road
  // Clip drag x between beginning of current segment and end of next segment
  if (x < rd[kind].sta[0])   x = rd[kind].sta[0]
  if (x > rd[kind+1].end[0]) x = rd[kind+1].end[0]

  // If keepIntervals is enabled, shift all future segments as well
  const maxind = kind+1
  if (opts.keepIntervals) maxind = rd.length
  for (let ii = kind; ii < maxind; ii++) {
    rd[ii].end[0] = x + roadsave[ii].end[0] 
                      - roadsave[kind].end[0]
  }
  if (isFinite(prevslopes[0]) && road[kind].sta[0] != road[kind].end[0]) {
    road[kind].slope = prevslopes[0]
  }
  if (isFinite(prevslopes[1]) && road[kind+1].sta[0] != road[kind+1].end[0]) {
    road[kind+1].slope = prevslopes[1]
  }
  br.fixRoadArray(rd, opts.keepSlopes ? br.RP.VALUE : br.RP.SLOPE,
                  false, br.RP.DATE)

  updateDragPositions(kind, true)
  updateDragInfo(d.end)
}
function knotDragEnded(d,i) {
  editingKnot = false

  if (selection == null) {
    unselectKnot(i)
    removeDragInfo()
    roadChanged()
  }
  roadsave = null
}

function knotDeleted(d) {
  const kind = Number(this.id)
  removeKnot(kind, false)
}

function changeKnotDate(kind, newDate, fromtable = true) {
  pushUndoState()

  const knotmin = (kind == 0) ? gol.xMin-10*SID*DIY 
                            : (road[kind].sta[0]) + 0.01
  const knotmax = (kind == road.length-1) ? road[kind].end[0]+0.01
                                        : road[kind+1].end[0]+0.01
  if (newDate <= knotmin) newDate = bu.daysnap(knotmin)
  if (newDate >= knotmax) newDate = bu.daysnap(knotmin)
  road[kind].end[0] = newDate
  if (!fromtable) {
    // TODO?
  }
  br.fixRoadArray(road, null, fromtable, br.RP.DATE)

  roadChanged()
}

function knotEdited(d, id) {
  const kind = Number(id)
  const el = d3.select(opts.divTable)
  if (road[kind].auto == br.RP.DATE) {
    if (opts.keepSlopes) disableValue(id)
    else disableSlope(id)
  }
  const cell = el.select('[name=enddate'+kind+']').node()
  cell.focus()
  let range, selection
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(cell)
    range.select()
  } else if (window.getSelection) {
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(cell)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// ---------------------- Functions for manipulating dots ----------------------

let editingDot = false
function dotDragStarted(d, id) {
  d3.event.sourceEvent.stopPropagation()
  editingDot = true
  pushUndoState()
  roadsave = br.copyRoad(road)
  const kind = id
  if (selection == null) {
    selectDot(kind)
  } else if (selection != null 
             && selection == kind && selectType == br.RP.VALUE) {
    clearSelection()
  } else {
    clearSelection()
    selectDot(kind)
  }
  if (kind != 0) {
    const seg = road[kind]
    createDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2,
                            (seg.sta[1]+seg.end[1])/2,
                            seg.slope*gol.siru] )
  } else createDragInfo(d.sta)
  dottext.grp.raise()
};
function dotDragged(d, id) {
  unselect()
  const now = gol.asof
  const y = nYSc.invert(d3.event.y)
  const kind = id
  const rd = road
  const seg = road[kind]
  seg.end[1] = y
  seg.slope = br.segSlope(seg)
  br.fixRoadArray(rd, opts.keepSlopes ? br.RP.VALUE
                                      : br.RP.SLOPE,
                  false, br.RP.VALUE)

  const strt = (kind==0) ? 0 : (kind-1)
  updateDragPositions(strt, false)
  if (kind != 0) {
    updateDragInfo( d.sta, [(seg.sta[0]+seg.end[0])/2,
                            (seg.sta[1]+seg.end[1])/2,
                            seg.slope*gol.siru])
  } else updateDragInfo(d.sta)
};
function dotDragEnded(d,id){
  editingDot = false

  if (selection == null) {
    unselectDot(id)
    removeDragInfo()
    roadChanged()
  } 
  roadsave = null
}

function changeDotValue(kind, newValue, fromtable = false) {
  pushUndoState()

  road[kind].end[1] = newValue
  if (!fromtable) {
    if (!opts.keepSlopes) road[kind].slope = br.segSlope(road[kind])
    if (kind == 1) {
      road[kind-1].sta[1] = newValue
    } else if (kind == road.length-1) {
      road[kind].end[1] = newValue
      road[kind-1].slope = (road[kind].sta[1] - road[kind-1].sta[1])
                         / (road[kind].sta[0] - road[kind-1].sta[0])
    } else {
      road[kind-1].slope = (road[kind].sta[1] - road[kind-1].sta[1])
                         / (road[kind].sta[0] - road[kind-1].sta[0])
    }
  }

  br.fixRoadArray(road, opts.keepSlopes ? br.RP.VALUE : null,
                  fromtable, br.RP.VALUE)

  roadChanged()
}

function dotEdited(d, id) {
  const kind = Number(id)
  const el = d3.select(opts.divTable)
  if (road[kind].auto == br.RP.VALUE) { disableSlope(id) }
  const cell = el.select('[name=endvalue'+kind+']').node()
  cell.focus()
  let range, selection
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(cell)
    range.select()
  } else if (window.getSelection) {
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(cell)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// ----------------- Functions for manipulating road segments ------------------

let editingRoad = false
let roadedit_x
function roadDragStarted(d, id) {
  //console.debug("roadDragStarted: "+id)
  d3.event.sourceEvent.stopPropagation()
  editingRoad = true
  roadedit_x = bu.daysnap(nXSc.invert(d3.event.x)/SMS)
  pushUndoState()
  roadsave = br.copyRoad(road)

  if (selection == null) {
    selectRoad(id)
  } else if (selection != null 
             && selection == id && selectType == br.RP.SLOPE) {
    clearSelection()
  } else {
    clearSelection()
    selectRoad(id)
  }
  let slopex = (d.sta[0]+d.end[0])/2
  if (slopex < nXSc.invert(0)/SMS) slopex = nXSc.invert(0)/SMS
  if (slopex > nXSc.invert(plotbox.width)/SMS - 10)
    slopex = nXSc.invert(plotbox.width)/SMS - 10
  createDragInfo(d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                         d.slope*gol.siru])
  slopetext.grp.raise()
};
function roadDragged(d, id) {
  //console.debug("roadDragged()")
  unselect()
  const now = gol.asof
  const x = bu.daysnap(nXSc.invert(d3.event.x)/SMS)
  const y = nYSc.invert(d3.event.y)
  const kind = id
  const rd = road

  road[kind].slope = ((y - d.sta[1])/max(x - d.sta[0], SID))
  road[kind].end[1] = road[kind].sta[1] + road[kind].slope*(road[kind].end[0] 
                                                          - road[kind].sta[0])
  road[kind+1].sta[1] = road[kind].end[1]
  if (!opts.keepSlopes) road[kind+1].slope = br.segSlope(road[kind+1])

  br.fixRoadArray(rd, br.RP.VALUE, false, br.RP.SLOPE)

  updateDragPositions(kind, true)
  let slopex = (d.sta[0]+d.end[0])/2
  if (slopex < nXSc.invert(0)/SMS) slopex = nXSc.invert(0)/SMS
  if (slopex > nXSc.invert(plotbox.width)/SMS - 10) 
    slopex = nXSc.invert(plotbox.width)/SMS - 10
  updateDragInfo(d.end, [slopex, d.sta[1]+d.slope*(slopex-d.sta[0]),
                         d.slope*gol.siru])
}
function roadDragEnded(d, id) {
  //console.debug("roadDragEnded()")
  editingRoad = false

  if (selection == null) {
    unselectRoad(id)
    removeDragInfo()
    roadChanged()
  }
  roadsave = null
}

function changeRoadSlope(kind, newSlope, fromtable = false) {
  if (kind == road.length-1) return
  pushUndoState()

  road[kind].slope = newSlope/(gol.siru)
  if (!fromtable) {
    if (!opts.keepSlopes) {
      road[kind].end[1] = road[kind].sta[1]+road[kind].slope*(road[kind].end[0] 
                                                            - road[kind].sta[0])
      road[kind+1].sta[1] = road[kind].end[1]
      road[kind+1].slope = br.segSlope(road[kind+1])
    }
  }
  br.fixRoadArray(road, null, fromtable, br.RP.SLOPE)

  roadChanged()
}

function roadEdited(d, id) {
  const kind = Number(id)
  const el = d3.select(opts.divTable)
  if (d.auto == br.RP.SLOPE) { disableValue(id) }
  const cell = el.select('[name=slope'+kind+']').node()
  cell.focus()
  let range, selection
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(cell)
    range.select()
  } else if (window.getSelection) {
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(cell)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// -------------------- Functions to animate SVG components --------------------

const anim = {
  buf: false, bux: false, aura: false, aurap: false,
  hor: false, hort: false, ybr: false, ybrc: false,
  guides: false, rosy: false, rosyd: false, data: false,
  dataa: false, mav:false
}
/** This function initiates a cyclic animation on a particular element, cycling
 * through the attribute and style information supplied in two arrays. Each
 * array is expected to include triples [name, v1, v0], cycling an attribute or
 * style with 'name' up to the v1 value in 'dur' milliseconds and back to v0 in
 * 'dur' milliseconds again, repeating indefinitely. */
function startAnim(elt, dur, attrs, styles, tag) {
  var tr = elt.transition().duration(dur), i
              
  for (i= 0; i< attrs.length; i++)
    tr = tr.attr(  attrs[i][0],  attrs[i][1])
  for (i= 0; i<styles.length; i++)
    tr = tr.style(styles[i][0], styles[i][1])

  tr = tr.transition().duration(dur)
  for (i= 0; i< attrs.length; i++)
    tr = tr.attr(attrs[i][0],    attrs[i][2])
  for (i= 0; i<styles.length; i++)
    tr = tr.style(styles[i][0], styles[i][2])
  tr.on("end", ()=>{if (anim[tag]) startAnim(elt, dur, attrs, styles, tag)})
  anim[tag] = true
}
function stopAnim(elt, dur, attrs, styles, tag) {
  anim[tag] = false
  let  tr = elt.transition().duration(dur)
  for (let i= 0; i<attrs.length; i++)  tr = tr.attr(attrs[i][0], attrs[i][2])
  for (let i= 0; i<styles.length; i++) tr = tr.style(styles[i][0], styles[i][2])
  tr.on("end", ()=>{anim[tag] = false})
}

function animBuf(enable) {
  if (opts.roadEditor) return
  const e = gWatermark.selectAll(".waterbuf")
  const x = Number(e.attr("x"))
  const y = Number(e.attr("y"))
  if  (e.node().tagName == 'text') {
    let sz = e.style("font-size")
    sz = Number(sz.substring(0,sz.length-2))
    let s =[["font-size", (sz*1.3)+"px",(sz)+"px"],
            ["fill", "#606060", opts.watermark.color]]
    let a =[["y", y+0.1*sz/3, y]]
    if (enable) startAnim(e, 500, a, s, "buf")
    else stopAnim(e, 300, a, s, "buf")
  } else {
    let h = opts.watermark.height
    let a =[["width", h*1.3, h], ["height", h*1.3, h],
            ["x", x-0.15*h, x], ["y", y-0.15*h, y]]
    if (enable) startAnim(e, 500, a, [], "buf")
    else stopAnim(e, 300, a, [], "buf")
  }
}

function animBux(enable) {
  if (opts.roadEditor) return
  const e = gWatermark.selectAll(".waterbux")

  let sz = e.style("font-size")
  sz = Number(sz.substring(0,sz.length-2))
  const y = Number(e.attr("y"))
  const s =[["font-size", (sz*1.3)+"px",(sz)+"px"],
          ["fill", "#606060", opts.watermark.color]]
  const a =[["y", y+0.15*sz, y]]
  if (enable) startAnim(e, 500, a, s, "bux")
  else stopAnim(e, 300, a, s, "bux")
}

function animAura(enable) {
  if (opts.roadEditor) return
  const e = gAura.selectAll(".aura")
  const ep = gAura.selectAll(".aurapast")
  
  const s =[["stroke",  "#9e559e", bu.BHUE.LPURP],
          ["fill",    "#9e559e", bu.BHUE.LPURP]]
  const sp =[["stroke", "#9e559e", bu.BHUE.LPURP],
           ["fill",   "#9e559e", bu.BHUE.LPURP]]
  const a =[["transform",  "translate(0,5)",  "translate(0,0)"]]
  const ap =[["transform", "translate(0,5)",  "translate(0,0)"]]
  if (enable) {
    startAnim(e,  500, a, s,  "aura")
    startAnim(ep, 500, ap, sp, "aurap")
  }
  else {
    stopAnim(e,  300, a, s,  "aura")
    stopAnim(ep, 300, ap, sp, "aurap")
  }
}

function animHor( enable ) {
  if (opts.roadEditor) return
  const o = opts.horizon
  
  const he = gHorizon.select(".horizon")
  const hte = gHorizonText.select(".horizontext")
  const a = [["stroke-width", r3(o.width*scf*3)+"px", r3(o.width*scf)+"px"]],
        s = [["stroke-dasharray", (o.dash*1.3)+","+(o.dash*0.7),
                                  (o.dash)+","+(o.dash)]]
  const ts = [["font-size",(o.font*1.2)+"px", (o.font)+"px"]]
  if (enable) {
    startAnim(he,  500, a,  s,  "hor")
    startAnim(hte, 500, [], ts, "hort")
  } else {
    stopAnim(he,  300, a,  s,  "hor")
    stopAnim(hte, 300, [], ts, "hort")
  }
}

function animYBR(enable) {
  if (opts.roadEditor) return
  // var e = gOldRoad.select(".oldlanes")
  let styles =[["fill-opacity", 1.0, 0.5],
               ["fill", "#ffff00", bu.BHUE.DYEL]]
  // if (enable) startAnim(e, 500, [], styles, "ybr")
  // else stopAnim(e, 300, [], styles, "ybr")

  const e = gRazr.select(".razr")
  styles =[["stroke-width",
            r3(opts.oldRoadLine.width*scf*2)+"px", 
            r3(opts.oldRoadLine.width*scf)+"px"]]
  if (enable) startAnim(e, 500, [], styles, "ybrc")
  else stopAnim(e, 300, [], styles, "ybrc")
}

function animGuides(enable) {
  if (opts.roadEditor) return
  const e = gGuides.selectAll(".guides")
  const a =[["stroke-width", r3(opts.guidelines.width*scf*2)+"px",
             d => (d<0 ? r3(opts.guidelines.weekwidth*scf)+"px"
                   : r3(opts.guidelines.width*scf)+"px")],
            ["stroke", d => (d<0 ? bu.BHUE.BIGG : "#ffff00"),
             d => (d<0 ? bu.BHUE.BIGG : bu.BHUE.LYEL)]]
  if (enable) startAnim(e, 500, [], a, "guides")
  else        stopAnim( e, 300, [], a, "guides")
  // TODO: also animate the maxflux line: 
  // oldguides -> oldmaxflux
  // guidelines -> maxfluxline
}

function animRosy(enable) {
  if (opts.roadEditor) return
  const e  = gRosy.selectAll(".rosy")
  const de = gRosyPts.selectAll(".rd")

  const s =[["stroke-width", r3(6*scf)+"px", r3(4*scf)+"px"]]
  const ds =[["r",
              r3(opts.dataPoint.size*scf*2)+"px", 
              r3(opts.dataPoint.size*scf)+"px"]]
  if (enable) { 
    startAnim(e,  500, [], s, "rosy")
    startAnim(de, 500, [], ds, "rd")
  }
  else {
    stopAnim(e,  300, [], s, "rosy")
    stopAnim(de, 300, [], ds, "rd")
  }
}

function animData(enable) {
  if (opts.roadEditor) return
  var e = gDpts.selectAll(".dp")
  var s =[["r",
            r3(opts.dataPoint.size*scf*2)+"px",
            r3(opts.dataPoint.size*scf)+"px"]]
  if (enable) startAnim(e, 500, [], s, "data")
  else        stopAnim(e,  300, [], s, "data")
  e = gAllpts.selectAll(".ap")
  s =[["r", r3(0.7*opts.dataPoint.size*scf*2)+"px", 
            r3(0.7*opts.dataPoint.size*scf)+"px"]]
  if (enable) startAnim(e, 500, [], s, "dataa")
  else        stopAnim(e,  300, [], s, "dataa")
}

function animMav(enable) {
  if (opts.roadEditor) return
  const e = gMovingAv.selectAll(".movingav")

  let a =[["stroke-width", r3(6*scf)+"px", r3(3*scf)+"px"]]
  if (enable) startAnim(e, 500, a, [], "mav")
  else        stopAnim(e,  300, a, [], "mav")
}

function animYBHPlines(enable) {
  if (opts.roadEditor) return
  const e = gYBHPlines.selectAll("#r11, #r22, #r66")
  const a =[["stroke-width", r3(4*scf)+"px", r3(1.5*scf)+"px"]]
  if (enable) startAnim(e, 500, a, [], "ybl")
  else        stopAnim(e,  300, a, [], "ybl")
}

// -------------------- Functions to update SVG components ---------------------

// Create or update the shaded box to indicate past dates
function updatePastBox() {
  if (processing || opts.divGraph == null || road.length == 0) return
  const pastelt = gPB.select(".past")
  if (!opts.roadEditor) {
    pastelt.remove()
    return
  }
  if (pastelt.empty()) {
    gPB.insert("svg:rect", ":first-child")
      .attr("class","past")
      .attr("x", nXSc(gol.xMin))
      .attr("y", nYSc(gol.yMax+3*(gol.yMax-gol.yMin)))
      .attr("width", nXSc(gol.asof*SMS) - nXSc(gol.xMin))
      .attr("height",7*abs(nYSc(gol.yMin) - nYSc(gol.yMax)))
      .attr("fill", opts.pastBoxCol.fill)
      .attr("fill-opacity", opts.pastBoxCol.opacity)
  } else {
    pastelt.attr("x", nXSc(gol.xMin))
           .attr("y", nYSc(gol.yMax + 3*(gol.yMax-gol.yMin)))
           .attr("width", nXSc(gol.asof*SMS) - nXSc(gol.xMin))
      .attr("height",7*abs(nYSc(gol.yMin) - nYSc(gol.yMax)))
  }
}

// Create or update the shaded box to indicate past dates
function updatePastText() {
  if (processing || opts.divGraph == null || road.length == 0) return
  const todayelt    = gGrid.select(".pastline")
  const pasttextelt = gPastText.select(".pasttext")
  if (!opts.roadEditor) {
    todayelt.remove()
    pasttextelt.remove()
    return
  }
  if (todayelt.empty()) {
    gGrid.append("svg:line").attr("class",         "pastline")
                            .attr("x1",            nXSc(gol.asof*SMS))
                            .attr("y1",            0)
                            .attr("x2",            nXSc(gol.asof*SMS))
                            .attr("y2",            plotbox.height)
                            .style("stroke",       bu.BHUE.AKRA) 
                            .style("stroke-width", r3(opts.today.width))
  } else {
    todayelt.attr("x1", nXSc(gol.asof*SMS))
            .attr("y1", 0)
            .attr("x2", nXSc(gol.asof*SMS))
            .attr("y2", plotbox.height)
  }
  const textx = nXSc(gol.asof*SMS)-8
  const texty = plotbox.height/2
  if (pasttextelt.empty()) {
    gPastText.append("svg:text")
      .attr("class","pasttext")
      .attr("x",textx ).attr("y",texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .attr("fill", bu.BHUE.AKRA) 
      .style("font-size", opts.horizon.font+"px") 
      .text("Today"+" ("+moment.unix(gol.asof).utc().format("ddd")+")")
  } else {
    pasttextelt
      .attr("x", textx).attr("y", texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .text("Today"+" ("+moment.unix(gol.asof).utc().format("ddd")+")")
  }
}

function updateContextToday() {
  if (processing || opts.divGraph == null || road.length == 0) return
  const todayelt    = ctxplot.select(".ctxtoday")
  const pasttextelt = ctxplot.select(".ctxtodaytext")
  if (!opts.roadEditor) {
    todayelt.remove()
    pasttextelt.remove()
    return
  }
  if (todayelt.empty()) {
    ctxplot.append("svg:line").attr("class",         "ctxtoday")
                              .attr("x1",            xScB(gol.asof*SMS))
                              .attr("y1",            0)
                              .attr("x2",            xScB(gol.asof*SMS))
                              .attr("y2",            brushbox.height)
                              .style("stroke",       "rgb(0,0,200)") 
                              .style("stroke-width", r3(opts.horizon.ctxwidth))
  } else {
    todayelt.attr("x1", xScB(gol.asof*SMS))
            .attr("y1", 0)
            .attr("x2", xScB(gol.asof*SMS))
            .attr("y2", brushbox.height)
  }
  const textx = xScB(gol.asof*SMS)-5
  const texty = brushbox.height/2

  if (pasttextelt.empty()) {
    ctxplot.append("svg:text")
      .attr("class",      "ctxtodaytext")
      .attr("x",          textx )
      .attr("y",          texty)
      .attr("transform",  "rotate(-90,"+textx+","+texty+")")
      .attr("fill",       "rgb(0,0,200)") 
      .style("font-size", (opts.today.ctxfont)+"px") 
      .text("Today")
  } else {
    pasttextelt.attr("x", textx)
               .attr("y", texty)
               .attr("transform", "rotate(-90,"+textx+","+texty+")")
  }
}

function createBullseyeDef() {
  beyegrp = defs.append("g").attr("id", "beye")
  beyegrp.append("ellipse")
    .attr("cx",56.5).attr("cy",60).attr("rx",23).attr("ry",53).attr("fill", "red")
  beyegrp.append("path").attr("d", "M41 7h15a23 53 0 0 1 0 106H41z").attr("fill","#fbb")
  beyegrp.append("ellipse")
    .attr("cx",41).attr("cy",60).attr("rx",23).attr("ry",53).attr("fill", "red")
  beyegrp.append("ellipse")
    .attr("cx",40).attr("cy",60).attr("rx",17).attr("ry",41).attr("fill", "#fff")
  beyegrp.append("ellipse")
    .attr("cx",39).attr("cy",60).attr("rx",14).attr("ry",31).attr("fill", "red")
  beyegrp.append("ellipse")
    .attr("cx",38).attr("cy",60).attr("rx",9).attr("ry",20).attr("fill", "#fff")
  beyegrp.append("ellipse")
    .attr("cx",37.5).attr("cy",60).attr("rx",5).attr("ry",10).attr("fill", "red")
}

function createBullseyePrevDef() {
  beyepgrp = defs.append("g").attr("id", "beyepre")
  beyepgrp.append("ellipse")
    .attr("cx",56.5).attr("cy",60).attr("rx",23).attr("ry",53).attr("fill", "#ffe407")
  beyepgrp.append("path").attr("d", "M41 7h15a23 53 0 0 1 0 106H41z").attr("fill","#fef7bc")
  beyepgrp.append("ellipse")
    .attr("cx",41).attr("cy",60).attr("rx",23).attr("ry",53).attr("fill", "#ffe407")
  beyepgrp.append("ellipse")
    .attr("cx",40).attr("cy",60).attr("rx",17).attr("ry",41).attr("fill", "#fff")
  beyepgrp.append("ellipse")
    .attr("cx",39).attr("cy",60).attr("rx",14).attr("ry",31).attr("fill", "#ffe407")
  beyepgrp.append("ellipse")
    .attr("cx",38).attr("cy",60).attr("rx",9).attr("ry",20).attr("fill", "#fff")
  beyepgrp.append("ellipse")
    .attr("cx",37.5).attr("cy",60).attr("rx",5).attr("ry",10).attr("fill", "#ffe407")
}
  
// Creates or updates the Bullseye at the goal date
function updateBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return
  var bullseyeelt = gBullseye.select(".bullseye")

  if (beyegrp == undefined) createBullseyeDef()
  var bx = r1(nXSc(gol.tfin*SMS))
  var by = r1(nYSc(br.rdf(road, gol.tfin)))
  if (bullseyeelt.empty()) {
    gBullseye.append("svg:use")
      .attr("xlink:href","#beye")
      .attr("class","bullseye")
      .attr("x",bx ).attr("y",by)
      .attr('transform', "scale(0.33) translate(-40,-60)")
      .attr('transform-origin', bx+" "+by)
  } else {
    bullseyeelt
      .attr("x", bx).attr("y", by)
      .attr('transform-origin', bx+" "+by)
  }
}

function updateContextBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var bullseyeelt = ctxplot.select(".ctxbullseye");

  if (beyegrp == undefined) createBullseyeDef()
  var bx = xScB(gol.tfin*SMS)
  var by = yScB(br.rdf(road, gol.tfin))
  if (bullseyeelt.empty()) {
    ctxplot.append("svg:use")
      .attr("xlink:href","#beye")
      .attr("class","ctxbullseye")
      .attr("x",bx ).attr("y",by)
      .attr('transform', "scale(0.16) translate(-40,-60)")
      .attr('transform-origin', bx+" "+by)
  } else {
    bullseyeelt.attr("x", bx).attr("y", by)
      .attr('transform-origin', bx+" "+by)
      .attr('transform-origin', bx+" "+by)
  }
}

// Creates or updates the Bullseye at the goal date
function updateOldBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var bullseyeelt = gOldBullseye.select(".oldbullseye");
  if (!opts.roadEditor) {
    bullseyeelt.remove();
    return;
  }

  if (beyepgrp == undefined) createBullseyePrevDef()
  var bx = nXSc(igoal.tfin*SMS)
  var by = nYSc(br.rdf(iroad, igoal.tfin));
  if (bullseyeelt.empty()) {
    gOldBullseye.append("svg:use")
      .attr("xlink:href","#beyepre")
      .attr("class","oldbullseye")
      .attr("x",bx ).attr("y",by)
      .attr('transform', "scale(0.33) translate(-40,-60)")
      .attr('transform-origin', bx+" "+by)
  } else {
    bullseyeelt
      .attr("x", bx).attr("y", by)
      .attr('transform-origin', bx+" "+by)
  }
}

function updateContextOldBullseye() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  var bullseyeelt = ctxplot.select(".ctxoldbullseye");
  if (!opts.roadEditor) {
    bullseyeelt.remove()
    return
  }

  if (beyepgrp == undefined) createBullseyePrevDef()
  var bx = xScB(iroad[iroad.length-1].sta[0]*SMS)
  var by = yScB(iroad[iroad.length-1].sta[1])
  if (bullseyeelt.empty()) {
    ctxplot.append("svg:use")
      .attr("xlink:href","#beyepre")
      .attr("class","ctxoldbullseye")
      .attr("x",bx ).attr("y",by)
      .attr('transform', "scale(0.16) translate(-40,-60)")
      .attr('transform-origin', bx+" "+by)
  } else {
    bullseyeelt
      .attr("x", bx).attr("y", by)
      .attr('transform-origin', bx+" "+by)
  }
}

function createInfinityDef() {
  if (infgrp != undefined) return
  infgrp = defs.append("g").attr("id", "inf")
  infgrp.append("path").attr("fill","black").attr("d","M 50.2,164.0 C 21.3,163.6 4.6,140.4 4.7,116.2 5,92 27.4,60.9 56.9,61.1 c 29.5,0.2 49.5,21.8 59.3,35.4 0,0 30.7,-36.0 59.6,-35.6 28.9,0.4 45.7,23.6 45.5,47.8 -0.2,24.2 -22.6,55.3 -52.2,55.1 -29.5,-0.2 -49.5,-21.8 -59.3,-35.4 0,0 -30.7,36 -59.6,35.6 z")
  infgrp.append("path").attr("fill","white").attr("d","m 100.6,117.2 c 0,0 -25.8,25.5 -43.1,25 C 40.1,141.7 30.5,122 31,105.1 31.5,88.3 38.7,71.2 53.4,71.4 68.1,71.7 86.6,93.1 100.6,117.2 Z")
  infgrp.append("path").attr("fill","white").attr("d","m 126.6,105.5 c 0,0 25.8,-25.5 43.1,-25 17.3,0.5 27,20.2 26.5,37.1 -0.5,16.9 -7.7,33.9 -22.4,33.7 -14.7,-0.2 -33.2,-21.7 -47.2,-45.7 z")
}
  
function createSkullDef() {
  if (sklgrp != undefined) return
  sklgrp = defs.append("g").attr("id", "skl")
  let g
  g = sklgrp.append("g").attr("fill","#222").attr("stroke","#fff")
  g.append("path").attr("d","m51.3 169 140-69.7s17.7 4.6 21.9 0.707c4.24-3.89 6.01-10.6 3.18-13.8-2.83-3.18-5.3 1.06-10.6-3.54s-1.06-4.6-6.01-8.84c-4.95-4.24-8.84-2.12-12 0.354s0 8.49-2.83 11c-2.83 2.47-141 72.5-141 72.5s-16.6 2.12-22.3 6.72c-5.66 4.6 1.41 7.07 4.6 11.7 3.18 4.6 1.77 6.01 6.01 8.84 4.24 2.83 5.66 1.77 9.9-1.77s5.66-11.3 9.55-14.1z")
  g.append("path").attr("d","m41.4 86.3s127 66.1 133 68.9c6.01 2.83 15.2-2.47 19.8-0.354 4.6 2.12 5.66 6.72 3.89 10.3-1.77 3.54-7.42 14.1-9.9 18.7-2.47 4.6-4.6 3.89-10.6 0.707s-4.24-13.8-6.36-14.8-127-65.8-132-68.2c-4.6-2.47-16.3 4.95-25.1 0.707-8.84-4.24-5.66-11.3-5.66-13.1s2.47-2.47 4.24-8.13c1.77-5.66-2.12-7.42 1.41-11.3 3.54-3.89 6.72-2.83 11-0.354 4.24 2.47 13.4 15.2 16.3 17z")
  g.append("path").attr("d","m109 20.9c17.9-0.508 44.6 7.07 51.6 14.5 7.07 7.42 15.9 17.7 17.3 45.3 1.41 27.6-5.02 22.2-9.55 35-4.12 11.7 2.15 16.3 1.06 22.3-2.14 11.8-19.8 8.77-24 10.2-2.32 0.8-4.24 6.01-4.24 6.01l-7.07 2.12s-1.1 2.93-0.62 8.75c-0.68-0.27-2.32 1.26-2.97 0.89-3.53-1.99-6.31-5.75-6.31-5.75l-0.36 8.13-7.77-0.35-0.71-4.25-1.42 4.6-5.3-0.35-2.12-4.95-4.6 2.47-3.53-1.06-1.06-11-3.54 8.84-4.6-1.77-1.41-5.3-1.41 2.83-3.18-2.48-1.41-9.19s-5.87-3.86-9.19-3.89c-2.54 0-4.58 3.34-7.07 2.83-3.43-0.7-6.34-4.1-7.42-7.42-1.4-4.32 2.84-8.96 2.12-13.4-2.72-17-15.2-18.2-15.2-49.5 0.02-12.3 2.37-25.3 11.6-34 9.21-8.73 31-19.5 52.4-20.1z")
  g.append("path").attr("d","m73.7 177c0.34 2.72 21 25.1 39.2 25 7.11-0.0235 33.2-11.7 36.4-21.1 0.752-2.19-1.86-6.06-1.94-9.19-0.144-5.21 2.93-14.1 2.39-15.5s-3.65-2.06-4.68-1.59-5.21 12.5-5.21 12.5l-1.94-0.884-3.45 0.884 1.41 6.54-2.3 2.39-1.94-6.1-3.89 1.33-0.354 3.18-1.68-0.177-1.68-3.45-3.18 0.442-2.3 6.72-2.39-0.442-2.21-4.86-4.33-1.33-1.41 4.77-2.92-0.442-1.41-4.86-4.51 0.177-1.06 3.18-1.41-0.884-1.68-5.57-5.3 0.884-0.354 5.39-1.59-0.265-0.795-8.57-3.8-0.177 1.24 8.31-3.01-4.77s-2.48-10.1-3.31-15.5c-0.111-0.731-1.98-0.492-2.86-0.126-1.16 0.481-2.82 1.34-2.54 2.78 0.452 2.26 3.62 10.5 3.75 12.6s-3.26 6.03-2.92 8.75z")
  g = sklgrp.append("g").attr("fill","#fff").attr("stroke","#fff")
  g.append("path").attr("d","m67.9 97.1c2.4-4.36 9.18-4.48 14.1-4.77 4.06-0.237 14.1 2.22 19.6 4.95 3.86 1.89 4.98 6.82 2.65 9.19-2.28 2.32-3.89 8.51-7.07 11.3-2.6 2.29-6.82 2.01-10.3 1.59-3.17-0.388-5.65-3.55-8.84-3.71-2.4-0.119-5.42 4.02-6.89 2.12-1.8-2.31-0.205-6.51-0.707-9.72-0.58-3.71-4.47-7.67-2.65-11z")
  g.append("path").attr("d","m122 102c2.06-3.69 11.8-5.75 17.3-7.78 3.18-1.16 6.85 0.177 10.5 1.49 2.75 0.984 5.97 1.8 6.44 2.4 0.647 0.812 0.362 4.38 0.797 7.36 0.508 3.48 1.61 6.46 0.44 8.2-2.16 3.19-10.1 7.83-16.1 7.78-4.69-0.0443-9.21-3.07-12.6-6.36-3.51-3.46-9.3-8.78-6.89-13.1z")
  g.append("path").attr("d","m114 112c2.25-0.23 4.3 6.35 6.79 9.3 1.64 1.94 3.31 2.8 5.01 5.68 1.55 2.63 0.192 7.63-1.5 8.52-1.44 0.758-5.6-1.44-6.6-2.56-1.59-1.76-0.862-6.48-3-6.44-2.6 0.0487-0.309 5.91-2.22 7.84-1.52 1.55-4.21 2.63-6.24 1.86-1.68-0.636-2.76-2.78-2.86-4.57-0.137-2.56 2.89-8.27 4.48-11.9 0.864-1.96 3.22-7.44 6.12-7.74z")
}

function createSmileyDef() {
  if (smlgrp != undefined) return
  smlgrp = defs.append("g").attr("id", "sml")
  let g
  smlgrp.append("path").attr("fill","#000").attr("d","m116 9c82 0.2 78 32 78 107 0 75 1 103-79 103-80 0-79-22-80-103-1-82-1-107 81-107z")
  smlgrp.append("path").attr("fill","#fff").attr("d","m115 32c55 0.1 51 25 51 83 0 58 7 80-49 80-56 0-54-19-55-81-0.8-63-2-82 53-81z")
  g = smlgrp.append("g").attr("fill","#000")
  g.append("path").attr("d","m115 146c10 0.2 18-8 19-14 2-6 5-11 11-11s10 5 10 13-11 33-40 33c-29 0-41-25-41-33s6-12 11-12c5 0 10 2 12 9 2 6 10 14 19 14z")
  g.append("circle").attr("cx",136).attr("cy",83).attr("r",18)
  g.append("circle").attr("cx",90).attr("cy",83).attr("r",18)
}
  
// Creates or updates the watermark with the number of safe days
function updateWatermark() {
  if (processing || opts.divGraph == null || road.length == 0 || hidden) return

  const tl = [0,0], bbl = [0, plotbox.height/2]
  const tr = [plotbox.width/2,0], bbr = [plotbox.width/2, plotbox.height/2]
  let offg, offb, g = null, sc = 1, b = null, x, y, bbox, newsize, newh

  setWatermark()
  if      (gol.waterbuf === ':(' ) {createSkullDef(); g = "#skl"; sc=0.76}
  if      (gol.waterbuf === 'inf') {createInfinityDef(); g = "#inf"; sc=0.76}
  else if (gol.waterbuf === ':)' ) {createSmileyDef(); g = "#sml"; sc = 0.76}

  if      (gol.dir>0 && gol.yaw<0) { offg = bbr; offb = tl  }
  else if (gol.dir<0 && gol.yaw>0) { offg = tr;  offb = bbl }
  else if (gol.dir<0 && gol.yaw<0) { offg = bbl; offb = tr  }
  else                             { offg = tl;  offb = bbr }

  let wbufelt = gWatermark.select(".waterbuf");
  const fs = opts.watermark.fntsize, wmh = opts.watermark.height
  wbufelt.remove();
  if (g != null) {
    x = (plotbox.width/2-wmh)/2;
    y = (plotbox.height/2-wmh)/2;
    wbufelt = gWatermark.append("svg:use")
      .attr("class","waterbuf")
      .attr("transform", "scale("+sc+")")
      .attr("transform-origin", (x+offg[0])+" "+(y+offg[1]))
      .attr("xlink:href",g)
  } else {
    x = plotbox.width/4;
    y = plotbox.height/4+fs/3;
    wbufelt = gWatermark.append("svg:text")
      .attr("class","waterbuf")
      //.attr("shape-rendering","crispEdges")
      .style('font-size', fs+"px")
      .style('font-weight', "bolder")
      .style('fill', opts.watermark.color)
      .text(gol.waterbuf);
    bbox = wbufelt.node().getBBox();
    if (bbox.width > plotbox.width/2.2) {
      newsize = (fs*(plotbox.width/2.2)
                 /bbox.width);
      newh = newsize/fs*bbox.height;
      y = plotbox.height/4+newh/3;
      wbufelt.style('font-size', newsize+"px");
    }        
  }
  wbufelt.attr("x", x + offg[0]).attr("y", y + offg[1]);

  let wbuxelt = gWatermark.select(".waterbux");
  wbuxelt.remove();
  if (!opts.roadEditor) {
    x = plotbox.width/4;
    y = plotbox.height/4+fs/3;
    wbuxelt = gWatermark.append("svg:text")
      .attr("class","waterbux")
      //.attr("shape-rendering","crispEdges")
      .style('font-size', fs+"px")
      .style('font-weight', "bolder")
      .style('fill', opts.watermark.color)
      .text(gol.waterbux);
    bbox = wbuxelt.node().getBBox();
    if (bbox.width > plotbox.width/2.2) {
      newsize = (fs*(plotbox.width/2.2)/bbox.width)
      newh = newsize/fs*bbox.height
      y = plotbox.height/4+newh/3
      wbuxelt.style('font-size', newsize+"px")
    }
    wbuxelt.attr("x", x + offb[0])
           .attr("y", y + offb[1])
  } else wbuxelt.remove()
}

function updateAura() {
  if (processing || opts.divGraph == null || road.length == 0 || hidden) return
  const el  = gAura.selectAll(".aura")
  const el2 = gAura.selectAll(".aurapast")
  if (gol.aura && opts.showData) {
    const dotsize = abs(nYSc.invert(0) - nYSc.invert(opts.dataPoint.size*scf))
    const thickness = max(gol.stdflux, r1(2*dotsize)) // at least 2X dotsize!
    const aurdn = min(0, -thickness)
    const aurup = max(0,  thickness)
    const fudge = PRAF*(gol.tmax-gol.tmin)
    const xr = [nXSc.invert(            0).getTime()/SMS, 
              nXSc.invert(plotbox.width).getTime()/SMS]
    let xvec, i
    xvec = griddle(max(xr[0], gol.tmin, min(gol.tini, data[0][0])),
                   bu.arrMin([xr[1], gol.horizon, gol.tmax+fudge]),
                   plotbox.width/8)
    // Generate a path string for the aura
    let 
      d = "M"+r1(nXSc(xvec[0]*SMS))+" "+r1(nYSc(gol.auraf(xvec[0])+aurup))
    for (i = 1; i < xvec.length; i++)
      d += 
        " L"+r1(nXSc(xvec[i]*SMS))+" "+r1(nYSc(gol.auraf(xvec[i])+aurup))
    for (i = xvec.length-1; i >= 0; i--)
      d += 
        " L"+r1(nXSc(xvec[i]*SMS))+" "+r1(nYSc(gol.auraf(xvec[i])+aurdn))
    d += " Z"
    if (el.empty()) {
      gAura.append("svg:path")
        .attr("class","aura").attr("d", d)
        .style("fill", bu.BHUE.LPURP)
        .style("stroke-width", 2).style("stroke", bu.BHUE.LPURP);
    } else {
      el.attr("d", d);
    }
    if (xr[0] < gol.tmin) {
      xvec = griddle(xr[0], gol.tmin, plotbox.width/8);
      d = "M"+r1(nXSc(xvec[0]*SMS))+" "+r1(nYSc(gol.auraf(xvec[0])+aurup))
      for (i = 1; i < xvec.length; i++)
        d += " L"+r1(nXSc(xvec[i]*SMS))+" "
                 +r1(nYSc(gol.auraf(xvec[i])+aurup))
      for (i = xvec.length-1; i >= 0; i--)
        d += " L"+r1(nXSc(xvec[i]*SMS))+" "
                 +r1(nYSc(gol.auraf(xvec[i])+aurdn))
      d += " Z";
      if (el2.empty()) {
        gAura.append("svg:path")
          .attr("class","aurapast").attr("d", d)
          .style("fill", bu.BHUE.LPURP)
          .style("stroke-width", 2)
          .style("stroke-dasharray", "4,4")
          .style("stroke", bu.BHUE.LPURP)
      } else {
        el2.attr("d", d)
      }
    } else 
      el2.remove()
  } else {
    el.remove()
    el2.remove()
  }
}

// Create or update the Akrasia Horizon line
function updateHorizon() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  const horizonelt = gHorizon.select(".horizon");
  const o = opts.horizon
  
  if (horizonelt.empty()) {
    gHorizon.append("svg:line")
      .attr("class","horizon")
      .attr("x1", nXSc(gol.horizon*SMS))
      .attr("y1",0)
      .attr("x2", nXSc(gol.horizon*SMS))
      .attr("y2",plotbox.height)
      .style("stroke", bu.BHUE.AKRA) 
      .style("stroke-dasharray", 
             (o.dash)+","+(o.dash)) 
      .attr("stroke-width", r3(o.width*scf))
  } else {
    horizonelt
      .attr("x1", nXSc(gol.horizon*SMS))
      .attr("y1",0)
      .attr("x2", nXSc(gol.horizon*SMS))
      .attr("y2",plotbox.height)
      .attr("stroke-width", r3(o.width*scf))
  }
  const textx = nXSc(gol.horizon*SMS)+(14);
  const texty = plotbox.height/2;
  const horizontextelt = gHorizonText.select(".horizontext");
  if (horizontextelt.empty()) {
    gHorizonText.append("svg:text")
      .attr("class","horizontext")
      .attr("x",textx ).attr("y",texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .attr("fill", bu.BHUE.AKRA) 
      .style("font-size", (o.font)+"px") 
      .text("Akrasia Horizon");
  } else {
    horizontextelt
      .attr("x", textx).attr("y", texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")");
  }
}

function updateContextHorizon() {
  if (processing || opts.divGraph == null || road.length == 0) return
  const horizonelt = ctxplot.select(".ctxhorizon")
  const o = opts.horizon
  if (horizonelt.empty()) {
    ctxplot.append("svg:line")
      .attr("class","ctxhorizon")
      .attr("x1", xScB(gol.horizon*SMS))
      .attr("y1", yScB(gol.yMin-5*(gol.yMax-gol.yMin)))
      .attr("x2", xScB(gol.horizon*SMS))
      .attr("y2", yScB(gol.yMax+5*(gol.yMax-gol.yMin)))
      .style("stroke", bu.BHUE.AKRA) 
      .style("stroke-dasharray", (o.ctxdash)+","+(o.ctxdash)) 
      .style("stroke-width", r3(o.ctxwidth))
  } else {
    horizonelt.attr("x1", xScB(gol.horizon*SMS))
              .attr("y1", yScB(gol.yMin-5*(gol.yMax-gol.yMin)))
              .attr("x2", xScB(gol.horizon*SMS))
              .attr("y2", yScB(gol.yMax+5*(gol.yMax-gol.yMin)))
  }

  const textx = xScB(gol.horizon*SMS)+12
  const texty = brushbox.height/2

  const hortextelt = ctxplot.select(".ctxhortext")
  if (hortextelt.empty()) {
    ctxplot.append("svg:text")
      .attr("class","ctxhortext")
      .attr("x",textx ).attr("y",texty)
      .attr("transform", "rotate(-90,"+textx+","+texty+")")
      .attr("fill", bu.BHUE.AKRA) 
      .style("font-size", (o.ctxfont)+"px") 
      .text("Horizon")
  } else {
    hortextelt.attr("x", textx)
              .attr("y", texty)
              .attr("transform", "rotate(-90,"+textx+","+texty+")")
  }
}

function updateYBHP() {
  if (processing || opts.divGraph == null || road.length == 0) return
  
  // Count all previously generated ybhp path elements on the current svg graph
  // so we can remove unused ones automatically 
  const ybhpreg   = d3.selectAll("#svg"+curid+" #ybhpgrp path")
  const ybhplines = d3.selectAll("#svg"+curid+" #ybhplinesgrp path")
  const prevcnt = ybhpreg.size()+ybhplines.size()

  // Region format: From d to D days to derailment (if d=D it's a region
  // boundary, i.e., an isoline of the DTD function), use fill-color fcolor,
  // stroke-color scolor, stroke-width w, and fill-opacity op.
  // Finally, xrange, a list like [xmin, xmax], gives the x-axis range to apply
  // it to. If xrange=null, use [-infinity, infinity].

  const xrfull   = [gol.tini, gol.tfin]       // x-axis range tini to tfin
  const xrakr    = [gol.asof, gol.asof+7*SID] // now to akrasia horizon
  const bgreen   = bu.BHUE.RAZR3 // bu.BHUE.GRNDOT // was RAZR3
  const bblue    = bu.BHUE.RAZR2
  const borange  = bu.BHUE.RAZR1
  const lyellow  = "#ffff88" // light yellow same as LYEL for classic YBR
  const llyellow  = "#ffffbd" // uluc had #ffffdd
  const gsw      = .99  // stroke width for guiding lines
  const gfo      = 1    // fill-opacity for guiding lines -- may not matter
  const rfo      = 0.72 // fill-opacity for regions
  const inf      = (gol.tfin-gol.tini)/SID // num safe days counting as infinite

  const regionsMaxflux = [
  //[  d,  D, fcolor,    scolor,    w,  op, xrange]
  //----------------------------------------------------------------------------
    [  0,  2, lyellow,   "none",    0, rfo, xrfull], // mimic old lanes
  //[  0, -2, "#fff5f5", "none",    0,   1, xrakr ], // nozone/oinkzone
    [inf, -1, llyellow,   "none",    0, rfo, xrfull], // infinitely safe region
  ]
  const regionsNormal = [
  //[  d,  D, fcolor,    scolor,    w,  op, xrange]
  //----------------------------------------------------------------------------
  //[  6, -1, "#b2e5b2", "none",    0, rfo, xrfull], // safe/gray region
    [  6,  6, "none",    bgreen,  gsw, gfo, xrfull], // 1-week isoline
  //[  2,  6, "#cceecc", "none",    0, rfo, xrfull], // green region (not used)
    [  2,  2, "none",    bblue,   gsw, gfo, xrfull], // blue isoline
  //[  1,  2, "#e5e5ff", "none",    0, rfo, xrfull], // blue region (not used)
    [  1,  1, "none",    borange, gsw, gfo, xrfull], // orange isoline
  //[  0,  1, "#fff1d8", "none",    0, rfo, xrfull], // orange region (not used)
    [  0,  2, lyellow,   "none",    0, rfo, xrfull], // mimic old lanes
  // Razor road currently in updateRedline because we can't define dashed lines
  // here; so the following doesn't work:
  //[  0,  0, "#ff0000", "none",    1, gfo, xrfull], // bright red line
  //[  0, -2, "#ffe5e5", "none",    0, rfo,   null], // whole bad half-plane
  //[  0, -2, "#fff5f5", "none",    0,   1, xrakr ], // nozone/oinkzone
    [inf, -1, llyellow,   "none",    0, rfo, xrfull], // infinitely safe region
  ]
  let regions
  if (false) { // change to true for debugging
    const debuglines = 10
    const regionsDebug = [
    //[  d,  D, fcolor,    scolor,    w,  op, xrange]
    //--------------------------------------------------------------------------
      //[  0,  2, lyellow,   "none",    0, 0.5, xrfull], // YBR equivalent
      //[  1,  1, "none",    "#0000ff", 1.5,   1, xrfull], // extra isoline
      //[  2,  2, "none",    "#2222ff", 1.5,   1, xrfull], // extra isoline
      //[  3,  3, "none",    "#4444ff", 1.5,   1, xrfull], // extra isoline
      //[  4,  4, "none",    "#6666ff", 1.5,   1, xrfull], // extra isoline
      //[  5,  5, "none",    "#8888ff", 1.5,   1, xrfull], // extra isoline
      [  6,  6, "none",    "#aaaaff", 1.5,   1, xrfull], // extra isoline
      [  7,  7, "none",    "#ccccff",   1.5,   1, xrfull], // extra isoline
      [  8,  8, "none",    bgreen,   1.5,   1, xrfull], // extra isoline
      [  9,  9, "none",    borange,   1.5,   1, xrfull], // extra isoline
      //[  10,  10, "none",    borange,   1.5,   1, xrfull], // extra isoline
      //[  11,  11, "none",    borange,   1.5,   1, xrfull], // extra isoline
      //[  12,  12, "none",    bblue,   1.5,   1, xrfull], // extra isoline
      //[  13,  13, "none",    borange,   1.5,   1, xrfull], // extra isoline
      //[  7,  7, "none",    "red",   1.5,   1, xrfull], // extra isoline
    ]
    regions = regionsDebug // debugging isolines
    const tmp = br.isoline(road, dtd, gol, debuglines, true)
    const adj = abs(nYSc.invert(2.5)-nYSc.invert(0))
    //console.log(JSON.stringify(tmp[3].map(e=>[bu.dayify(e[0]), e[1]])))
    iso[6] = tmp[0]
    iso[7] = tmp[1]
    iso[8] = tmp[2]
    iso[9] = tmp[3]
    iso[7] = iso[7].map(e => [e[0], e[1]+1*adj])
    iso[8] = iso[8].map(e => [e[0], e[1]+2*adj])
    iso[9] = iso[9].map(e => [e[0], e[1]+3*adj])
  } else {
    regions = gol.maxflux > 0 ? regionsMaxflux : regionsNormal
  }
  
  // HT cpcallen who proposed changing this max to a min, though turns out
  // that's wrong. Sad trombone!
  for (let ri = 0; ri < max(prevcnt, regions.length); ri++) {
    // SVG elements for regions are given unique class names
    const clsname = "halfplane"+ri
    const reg = regions[ri]

    // Force removal of leftover regions or lines if requested or stale detected
    if (reg == undefined || (reg[2] == null && reg[3] == null)) {
      gYBHP.select("."+clsname).remove()
      gYBHPlines.select("."+clsname).remove()
      continue
    }

    let ybhpelt, ybhpgrp
    if (reg[0] != reg[1]) {
      // Regions are drawn on their own container
      ybhpgrp = gYBHP
      // Remove any previously created lines with this name to prevent
      // leftovers from earlier graph instances
      gYBHPlines.select("."+clsname).remove()
    } else {
      // Lines are drawn on their own container
      ybhpgrp = gYBHPlines
      // Remove any previously created regions with this name to prevent
      // leftovers from earlier graph instances
      gYBHP.select("."+clsname).remove()
    }
    ybhpelt = ybhpgrp.select("."+clsname)
    const id = "r"+reg[0]+reg[1]

    // Adjustment to y coordinates by half the stroke width
    const adj = gol.yaw*reg[4]/2

    let xr = reg[6]
    if (xr == null) xr = [-Infinity, Infinity]

    const rstrt = reg[0]
    const rend  = reg[1]

    // Starting boundary for a region is not allowed to be infinity
    if (rstrt < 0) {
      console.log("updateYBHP(): Invalid region definition")
      continue
    }
    
    // Clip start and end points to within the requested range
    let xstrt = road[0].end[0] //-100*SID
    let xend = road[road.length-1].sta[0]
    if (xstrt < xr[0]) xstrt = xr[0]
    if (xend  > xr[1]) xend = xr[1]

    // Determine good side of the road for boundaries at infinity
    let yedge, yedgeb
    if (gol.yaw < 0) {
      yedge  = gol.yMin - 0.1*(gol.yMax - gol.yMin)
      yedgeb = gol.yMax + 0.1*(gol.yMax - gol.yMin)
    } else {
      yedge  = gol.yMax + 0.1*(gol.yMax - gol.yMin)
      yedgeb = gol.yMin - 0.1*(gol.yMax - gol.yMin)
    }

    // Construct a path element for the starting DTD value. This will be the
    // only path if the starting and ending DTD values are the same.
    const isostrt = getiso(rstrt)

    let x = isostrt[0][0]
    let y = isostrt[0][1]
    if (x < xstrt) { x = xstrt; y = br.isoval(isostrt, x) }
    let d = "M"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
    for (let i = 1; i < isostrt.length; i++) {
      x = isostrt[i][0]; y = isostrt[i][1]
      if (x < xstrt) continue
      if (x > xend) { x = xend; y = br.isoval(isostrt, x) }
      d += " L"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
      if (isostrt[i][0] > xend) break
    }

    if (rend == -1) {
      // Region on the good side of the road
      d += " L"+r1(nXSc(xend *SMS))+" "+r1(nYSc(br.isoval(isostrt, xend))+adj)
      d += " L"+r1(nXSc(xend *SMS))+" "+r1(nYSc(yedge))
      d += " L"+r1(nXSc(xstrt*SMS))+" "+r1(nYSc(yedge))
      d += " Z"
    } else if (rend == -2) {
      // Region on the bad side of the road
      d += " L"+nXSc(xend *SMS)+" "+r1(nYSc(br.isoval(isostrt, xend))+adj)
      d += " L"+r1(nXSc(xend *SMS))+" "+r1(nYSc(yedgeb))
      d += " L"+r1(nXSc(xstrt*SMS))+" "+r1(nYSc(yedgeb))
      d += " Z"
    } else if (rstrt != rend) {
      // End DTD value different than start value, so construct a return path
      // to build an enclosed region
      const isoend = getiso(rend)
      const ln = isoend.length
      let x = isoend[ln-1][0]
      let y = isoend[ln-1][1]
      if (x > xend) { x = xend; y = br.isoval(isoend, x) }
      d += " L"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
      for (let i = ln-2; i >= 0; i--) {
        x = isoend[i][0]
        y = isoend[i][1]
        if (x > xend) continue
        if (x < xstrt) { x = xstrt; y = br.isoval(isoend, x) }
        d += " L"+r1(nXSc(x*SMS))+" "+r1(nYSc(y)+adj)
        if (isoend[i][0] < xstrt) break
      }
      d += " Z"
    }

    if (ybhpelt.empty()) { // create a new element if an existing one not found
      ybhpgrp.append("svg:path").attr("class",          "ybhp "+clsname)
                                .attr("id",             id)
                                .attr("d",              d)
                                .attr("fill",           reg[2])
                                .attr("fill-opacity",   reg[5])
                                .attr("stroke",         reg[3])
                                .attr("stroke-width",   reg[4])
    } else { // update previously created element
      ybhpelt.attr("d",            d)
             .attr("id",             id)
             .attr("fill",         reg[2])
             .attr("fill-opacity", reg[5])
             .attr("stroke",       reg[3])
             .attr("stroke-width", reg[4])
    }
  }
}

function updatePinkRegion() {                         // AKA nozone AKA oinkzone
  if (processing || opts.divGraph == null || road.length == 0) return

  const pinkelt = gPink.select(".pinkregion")
  const valid = isRoadValid(road)
  let rd = iroad
  // For non-editor graphs, use the most recent road
  if (!opts.roadEditor) rd = road
  
  const now = gol.asof
  const hor = gol.horizon
  let yedge
  if (gol.yaw > 0) yedge = gol.yMin - 5*(gol.yMax - gol.yMin)
  else             yedge = gol.yMax + 5*(gol.yMax - gol.yMin)
  const color = "url(#pinkzonepat"+curid+")"

  const pr = d3.select(" #pinkzonepat"+curid+" rect")
  const pl = d3.select(" #pinkzonepat"+curid+" line")
  pr.attr("fill", (valid||!opts.roadEditor)?bu.BHUE.PINK:"#ffbbbb")
  pl.style("stroke", (valid||!opts.roadEditor)?"#aaaaaa":"#666666")
  
  // Compute road indices for left and right boundaries
  const itoday = br.findSeg(rd, now)
  const ihor   = br.findSeg(rd, hor)
  let d = "M"+nXSc(now*SMS)+" "+nYSc(br.rdf(rd, now))
  for (let i = itoday; i < ihor; i++) {
    d += " L"+nXSc(rd[i].end[0]*SMS)
         +" "+nYSc(rd[i].end[1])
  }
  d += " L"+nXSc(hor*SMS)+" "+nYSc(br.rdf(rd, hor))
  d += " L"+nXSc(hor*SMS)+" "+nYSc(yedge)
  d += " L"+nXSc(now*SMS)+" "+nYSc(yedge)
  d += " Z"
  gPinkPat.attr("patternTransform", gol.dir > 0 ? "rotate(135)" : "rotate(45)")
          .attr("x", -gol.dir*nXSc(now*SMS))
  
  if (pinkelt.empty()) {
    gPink.append("svg:path").attr("class",        "pinkregion")
                            .attr("d",            d)
                            .attr("fill-opacity", 0.4)
                            .attr("fill",         color)
  } else {
    pinkelt.attr("d", d).attr("fill", color)
  }
}

// This stands separate from updateYBHP because we need to use it for the "old",
// unedited road as well. This now supports a delta argument for the maxflux
// line, and a dash argument for the editor version. If scol == null, then the
// element is deleted to clean up leftovers from earlier draws.
// TODO: rename this to updateRazrRoad or updateYBR
function updateRedline(rd, g, gelt, cls, delta, usedash) {
  if (processing || opts.divGraph == null || road.length == 0) return
  
  const roadelt = gelt.select("."+cls)
  if (delta == null) {
    roadelt.remove()
    return
  }

  //const sg   = (!opts.roadEditor)
  const dash = (opts.oldRoadLine.dash)+","+ceil(opts.oldRoadLine.dash/2)
  const sda  = usedash ? dash : null // stroke-dasharray

  // fx,fy: Start of the current line segment
  // ex,ey: End of the current line segment
  let fx = nXSc(rd[0].sta[0]*SMS), fy = nYSc(rd[0].sta[1]+delta)
  let ex = nXSc(rd[0].end[0]*SMS), ey = nYSc(rd[0].end[1]+delta)
  if (rd[0].sta[0] < g.tini) {
    fx  = nXSc(g.tini*SMS)
    // Using vini instead of the rdf below does not work for some
    // goals where vini ends up not on the road itself -- uluc
    // But let's do stricter error-checking so we can count on rdf(tini)==vini!
    fy  = nYSc(br.rdf(rd, g.tini)+delta)
    //fy  = nYSc(g.vini+delta)
  }

  if (usedash) {
    // Adjust start of road so dashes are stationary wrt time
    const newx = (-nXSc(g.tini*SMS)) % ceil(1.5*opts.oldRoadLine.dash)
    if (ex !== fx) fy = (fy + (-newx-fx)*(ey-fy)/(ex-fx))
    if (fx < 0 || newx > 0) fx = -newx
  }

  let d = "M"+r1(fx)+" "+(r1(fy))
  for (const segment of rd) {
    // Some goals have non-daysnapped graph matrix entries, which
    // breaks the tfin check. This hopefully overcomes that problem
    let segx = bu.daysnap(segment.end[0])
    ex = nXSc(segment.end[0]*SMS)
    if (segx < g.tini) continue
    if (segx > g.tfin) break
    ey = nYSc(segment.end[1]+delta)
    d += " L"+r1(ex)+" "+(r1(ey))
    if (ex > plotbox.width) break
  }
  if (roadelt.empty()) {
    gelt.append("svg:path").attr("class", cls)
                                 .attr("d", d)
                                 .style("stroke-dasharray", sda)
  } else {
    roadelt.attr("d", d).style("stroke-dasharray", sda)
  }
}

/* Determine whether a given line segment intersects the given bounding box.
Follows the algorithm in
https://noonat.github.io/intersect/#axis-aligned-bounding-boxes
The bbox parameter should include the center and the half sizes like so:
  [x_mid, y_mid, w_half, h_half] */
function lineInBBox(line, bbox) {
//  console.log("Intersecting "+JSON.stringify(line.map(e=>[bu.dayify(e[0]), e[1]]))+" with "+JSON.stringify([bu.dayify(bbox[0]-bbox[2]), bbox[1]-bbox[3], bu.dayify(bbox[0]+bbox[2]), bbox[1]+bbox[3]]))
  let delta = [line[1][0] - line[0][0], 
               line[1][1] - line[0][1]]
  const scaleX = 1.0 / delta[0]
  const scaleY = 1.0 / delta[1]
  const signX = Math.sign(scaleX)
  const signY = Math.sign(scaleY)
  const nearTimeX = (bbox[0] - signX * bbox[2] - line[0][0]) * scaleX
  const nearTimeY = (bbox[1] - signY * bbox[3] - line[0][1]) * scaleY
  const farTimeX  = (bbox[0] + signX * bbox[2] - line[0][0]) * scaleX
  const farTimeY  = (bbox[1] + signY * bbox[3] - line[0][1]) * scaleY    
  if (nearTimeX > farTimeY || nearTimeY > farTimeX) return false
  const nearTime = nearTimeX > nearTimeY ? nearTimeX : nearTimeY
  const farTime  = farTimeX  < farTimeY  ? farTimeX  : farTimeY
  if (nearTime > 1 || farTime < 0) return false
  return true
}
  
function isovisible(iso, bbox) {
  if (!iso || !iso.length) return false
  // TODO: For efficiency, limit intersection search to isolines in xrange
  const left  = bbox[0] - bbox[2]
  const right = bbox[0] + bbox[2]
  let a = bu.searchLow(iso, p => p[0] < left  ? -1 : 1)
  let b = bu.searchLow(iso, p => p[0] < right ? -1 : 1)
  if (a < 0) a = 0
  if (b > iso.length - 2) b = iso.length - 2
  for (let i=a; i<=b; i++) if (lineInBBox([iso[i], iso[i+1]], bbox)) return true
  return false
}

// Returns true if two isolines overlap within the specified x range in bbox
function isocompare(isoa, isob, bbox) {
  if (!isoa || !isoa.length || !isob || !isob.length) return false
  const EPS = 1e-5 // or 1e-9 works fine; maybe have it depend on y-values?
  // TODO: For efficiency, limit intersection search to isolines in xrange
  const left  = bbox[0] - bbox[2]
  const right = bbox[0] + bbox[2]
  // Fail if isolines differ on the boundaries. 
  // TODO: This duplicates the boundary search below. Combine.
  if (abs(br.isoval(isoa,  left) - br.isoval(isob,  left)) > EPS ||
      abs(br.isoval(isoa, right) - br.isoval(isob, right)) > EPS) return false
  
  let la = bu.searchHigh(isoa, p => p[0] < left  ? -1 : 1)
  let ra = bu.searchLow( isoa, p => p[0] < right ? -1 : 1)
  let lb = bu.searchHigh(isob, p => p[0] < left  ? -1 : 1)
  let rb = bu.searchLow( isob, p => p[0] < right ? -1 : 1)
  // Evaluate the alternate isoline on inflection points
  for (let i = la; i < ra; i++)
    if (abs(br.isoval(isob, isoa[i][0]) - isoa[i][1]) > EPS) return false
  for (let i = lb; i < rb; i++)
    if (abs(br.isoval(isoa, isob[i][0]) - isob[i][1]) > EPS) return false
  return true
}
  
/* Compute the maximum visible DTD isoline, searching up to the specified limit.
 * Does binary search on the isolines between 0 and limit, checking whether a
 * given isoline intersects the visible graph or not. Since isolines never 
 * intersect each other, this should be guaranteed to work unless the maximum
 * DTD isoline is greater than limit in which case limit is returned. */
let glarr, gllimit = -1 // should be more efficient to not recompute these
function maxVisibleDTD(limit) {
  const isolimit = getiso(limit)
  const xr = [nXSc.invert(0)/SMS         , nXSc.invert(plotbox.width)/SMS]
  const yr = [nYSc.invert(plotbox.height), nYSc.invert(0)]
  const bbox = [(xr[0]+xr[1])/2, (yr[0]+yr[1])/2,
                (xr[1]-xr[0])/2, (yr[1]-yr[0])/2]

  if (limit != gllimit) {
    // For efficiency, only compute the search array when there's a change
    gllimit = limit
    glarr = Array(limit).fill().map((x,i)=>i)
  }

  // If upper limit is visible, nothing to do, otherwise proceed with the search
  if (isovisible(isolimit, bbox)) {
    // TODO: Find min isoline that overlaps w/ limit w/in the visible range
    const maxdtd = 
      bu.searchHigh(glarr, i=>isocompare(isolimit, getiso(i), bbox) ? 1:-1)
    return min(maxdtd, glarr.length - 1)
  }
  
  const maxdtd = bu.searchLow(glarr, i=>isovisible(getiso(i), bbox) ? -1:1)
  return max(maxdtd, 0)
  // Is it weird that the function to search by is something that itself does
  // a search? Probably Uluc is just a couple levels ahead of me but at some 
  // point I'll want to get my head around that! --dreev
}

function updateGuidelines() {
  if (processing || opts.divGraph == null || road.length == 0) return

  let guideelt = gGuides.selectAll(".guides")
  if (opts.roadEditor && !opts.showGuidelines) {
    guideelt.remove(); return
  }
  
  let skip = 1 // Show only one per this many guidelines
  
  // Create an index array as d3 data for guidelines
  // (Fun fact: the .invert() call returns a javascript date objects but when
  // you divide a Date object by a number that coerces it to a number, namely
  // unixtime in milliseconds. So doing .invert().getTime() is unnecessary.)
  const xrange = [nXSc.invert(            0)/SMS,
                  nXSc.invert(plotbox.width)/SMS]
  const buildPath = ((d,i) =>
                     getisopath(d, [max(gol.tini, xrange[0]),
                                    min(gol.tfin, xrange[1])]))
  
  const lnw = isolnwborder(xrange) // estimate intra-isoline delta
  const lnw_px = abs(nYSc(0) - nYSc(lnw))
  const numdays = ceil((gol.tfin-gol.tini)/SID)

  let numlines = maxVisibleDTD(numdays)

  if      (lnw_px>8 || numlines<6*7)          skip = 1  // All lines till 6w
  else if (7*lnw_px>8 || numlines<6*28)       skip = 7  // Weekly lines till 6mo
  else if (28*lnw_px>12 || numlines<2*12*28)  skip = 28 // Monthly lines till 2y
  else if (4*28*lnw_px>12 || numlines<6*12*28) skip = 4*28 // 4mo lines till 6y
  else                                   skip = 12*28 // Yearly lines afterwards

  numlines = ceil(numlines/skip)
  //console.log(
  //  `DEBUG delta=${delta} lnw=${lnw} numlines=${numlines} \
  //  yrange=${yrange[0]},${yrange[1]}`)

  // glarr should have been generated by the call to maxVisibleDTD() above
  let arr = glarr.slice(0, numlines+1).map(d => (d+1)*skip-1)

  guideelt = guideelt.data(arr)
  guideelt.exit().remove()
  guideelt.enter().append("svg:path")
    .attr("class",           "guides")
    .attr("d",               buildPath)
    .attr("id",              (d)=>("g"+d))
    .attr("transform",       null)
  guideelt
     .attr("d",               buildPath)
     .attr("id",              (d)=>("g"+d))
     .attr("transform",       null)
}

function updateRazrRoad() {
  if (processing || opts.divGraph == null || road.length == 0) return

  // Razor line differs between the editor (dashed) and the graph (solid). Also,
  // the road editor shows the initial road as the razor road.
  if (opts.roadEditor) updateRedline(iroad, igoal, gRazr, "razr", 0, true)
  else                 updateRedline(road,  gol,   gRazr, "razr", 0, false)
}

function updateMaxFluxline() {
  if (processing || opts.divGraph == null || road.length == 0) return

  // Generate the maxflux line if maxflux!=0. Otherwise, remove existing one
  updateRedline(road, gol, gMaxflux, "maxflux", 
    gol.maxflux != 0 ? gol.yaw*gol.maxflux : null, false)
}

function updateStdFluxline() {
  if (processing || opts.divGraph == null || road.length == 0) return

  // Generate the maxflux line if maxflux!=0. Otherwise, remove existing one
  updateRedline(road, gol, gStdflux, "stdflux", 
    gol.maxflux != 0 ? gol.yaw*gol.stdflux : null, true)
}

  
function updateContextOldRoad() {
  if (processing || opts.divGraph == null || road.length == 0) return
  // Create, update, and delete road lines on the brush graph
  const roadelt = ctxplot.selectAll(".ctxoldroads")
  let rd = iroad
  // For non-editor graphs, use the most recent road
  if (!opts.roadEditor) rd = road
  let d = "M"+r1(xScB(rd[0].sta[0]*SMS))+" "
             +r1(yScB(rd[0].sta[1]))
  for (let i = 0; i < rd.length; i++) {
    d += " L"+r1(xScB(rd[i].end[0]*SMS))+" "
             +r1(yScB(rd[i].end[1]))
  }
  if (roadelt.empty()) {
    ctxplot.append("svg:path")
      .attr("class","ctxoldroads")
      .attr("d", d)
      .style("stroke-dasharray",
             (!opts.roadEditor)?null:(opts.oldRoadLine.ctxdash)+","
             +ceil(opts.oldRoadLine.ctxdash/2))
      .style("fill", "none")
      .style("stroke-width",opts.oldRoadLine.ctxwidth)
      .style("stroke", !opts.roadEditor ? bu.BHUE.RAZR0
                                        : bu.BHUE.ORNG) // TODO: don't need this
  } else {
    roadelt.attr("d", d)
      .style("stroke-dasharray",
             (!opts.roadEditor)?null:(opts.oldRoadLine.ctxdash)+","
             +ceil(opts.oldRoadLine.ctxdash/2))
      .style("stroke", !opts.roadEditor ? bu.BHUE.RAZR0
                                        : bu.BHUE.ORNG) // TODO: don't need this
  }
}

// Creates or updates vertical lines for odometer resets
function updateOdomResets() {
  if (processing || opts.divGraph == null || road.length == 0 || bbr.oresets.length == 0)
    return

  // Create, update and delete vertical knot lines
  const orelt = gOResets.selectAll(".oresets").data(bbr.oresets)
  if (opts.roadEditor) { orelt.remove(); return }
  orelt.exit().remove()
  orelt
    .attr("x1", function(d){ return nXSc(d*SMS) })
    .attr("y1", 0)
    .attr("x2", function(d){ return nXSc(d*SMS) })
    .attr("y2", plotbox.height)
  orelt.enter().append("svg:line")
    .attr("class","oresets")
    .attr("id", function(d,i) { return i })
    .attr("name", function(d,i) { return "oreset"+i })
    .attr("x1", function(d){ return nXSc(d*SMS) })
    .attr("y1", 0)
    .attr("x2", function(d){ return nXSc(d*SMS) })
    .attr("y2", plotbox.height)
    .attr("stroke", "rgb(200,200,200)") 
      .style("stroke-dasharray", 
             (opts.odomReset.dash)+","+(opts.odomReset.dash)) 
    .attr("stroke-width",opts.odomReset.width)
}

function updateKnots() {
  if (processing || opts.divGraph == null || road.length == 0) return
  // Create, update and delete vertical knot lines
  const knotelt = gKnots.selectAll(".knots").data(road)
  const knotrmelt = buttonarea.selectAll(".remove").data(road)
  if (!opts.roadEditor) {
    knotelt.remove()
    knotrmelt.remove()
    return
  }
  knotelt.exit().remove()
  knotelt
    .attr("x1", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("y1", 0)
    .attr("x2", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("y2", plotbox.height)
    .attr("stroke", "rgb(200,200,200)") 
    .attr("stroke-width",opts.roadKnot.width)
  knotelt.enter().append("svg:line")
    .attr("class","knots")
    .attr("id", function(d,i) {return i})
    .attr("name", function(d,i) {return "knot"+i})
    .attr("x1", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("x2", function(d){ return nXSc(d.end[0]*SMS)})
    .attr("stroke", "rgb(200,200,200)")
    .attr("stroke-width",opts.roadKnot.width)
    .on('wheel', function(d) {
      // Redispatch a copy of the event to the zoom area
      const new_event = new d3.event.constructor(d3.event.type, d3.event)
      zoomarea.node().dispatchEvent(new_event)
      // Prevents mouse wheel event from bubbling up to the page
      d3.event.preventDefault()
    }, {passive:false})
    .on("mouseover",function(d,i) {
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.DATE && i == selection)) {
        highlightDate(i,true)
        d3.select(this)
          .attr("stroke-width",(opts.roadKnot.width+2))
      }})
    .on("mouseout",function(d,i) {
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.DATE && i == selection)) {
        highlightDate(i,false)
        d3.select(this)
          .attr("stroke-width",opts.roadKnot.width);
      }})
    .on("click", function(d,i) { 
      if (d3.event.ctrlKey) knotEdited(d,this.id);})
    .call(d3.drag()
          .on("start", knotDragStarted)
          .on("drag", knotDragged)
          .on("end", knotDragEnded))

  // Create, update and delete removal icons for knots
  knotrmelt.exit().remove()
  knotrmelt
  //                .attr("id", function(d,i) {return i;})
  //              .attr("name", function(d,i) {return "remove"+i;})
    .attr("transform", 
          function(d){ 
            return "translate("+(nXSc(d.end[0]*SMS)
                                 +plotpad.left-14*opts.roadKnot.rmbtnscale)
              +","+(plotpad.top-28*opts.roadKnot.rmbtnscale-3)+") scale("+opts.roadKnot.rmbtnscale+")";
          })
    .style("visibility", function(d,i) {
      return (i > 0 && i<road.length-2)
        ?"visible":"hidden";});
  knotrmelt.enter()
    .append("use")
    .attr("class", "remove")
    .attr("xlink:href", "#removebutton")
    .attr("id", function(d,i) {return i;})
    .attr("name", function(d,i) {return "remove"+i;})
    .attr("transform", 
          function(d){ 
            return "translate("+(nXSc(d.end[0]*SMS)
                                 +plotpad.left-14*opts.roadKnot.rmbtnscale)
              +","+(plotpad.top-28*opts.roadKnot.rmbtnscale-3)+") scale("+opts.roadKnot.rmbtnscale+")";
          })
    .style("visibility", function(d,i) {
      return (i > 0 && i < road.length-2)
        ?"visible":"hidden";})
    .on("mouseenter",function(d,i) {
      d3.select(this).attr("fill",opts.roadKnotCol.rmbtnsel); 
      highlightDate(i, true);})
    .on("mouseout",function(d,i) {
      d3.select(this).attr("fill",opts.roadKnotCol.rmbtns);
      highlightDate(i, false);})
    .on("click",knotDeleted);
}

function updateRoads() {
  if (processing || opts.divGraph == null || road.length == 0) return;
  //let valid = isRoadValid( road )
  //var lineColor = valid?opts.roadLineCol.valid:opts.roadLineCol.invalid;

  // Create, update and delete road lines
  const roadelt = gRoads.selectAll(".roads").data(road);
  if (!opts.roadEditor) {
    roadelt.remove();
    return;
  }
  roadelt.exit().remove();
  roadelt
    .attr("x1", function(d) { return nXSc(d.sta[0]*SMS) })
    .attr("y1", function(d) { return nYSc(d.sta[1]) })
    .attr("x2", function(d) { return nXSc(d.end[0]*SMS) })
    .attr("y2", function(d) { return nYSc(d.end[1]) })
    .attr("stroke-dasharray",
          function(d,i) { return (i==0||i==road.length-1)?"3,3":"none"})
    .style("stroke",opts.roadLineCol.invalid)
  roadelt.enter()
    .append("svg:line")
    .attr("class","roads")
    .attr("id",   function(d,i) { return i })
    .attr("name", function(d,i) { return "road"+i })
    .attr("x1",   function(d)   { return nXSc(d.sta[0]*SMS) })
    .attr("y1",   function(d)   { return nYSc(d.sta[1]) })
    .attr("x2",   function(d)   { return nXSc(d.end[0]*SMS) })
    .attr("y2",   function(d)   { return nYSc(d.end[1]) })
    .style("stroke", opts.roadLineCol.invalid)
    .attr("stroke-dasharray",
          function(d,i) { return (i==0||i==road.length-1)?"3,3":"none"})
    .attr("stroke-width",opts.roadLine.width)
    .on('wheel', function(d) { 
      // Redispatch a copy of the event to the zoom area
      const new_event = new d3.event.constructor(d3.event.type, d3.event)
      zoomarea.node().dispatchEvent(new_event)
      // Prevents mouse wheel event from bubbling up to the page
      d3.event.preventDefault()
    }, {passive:false})      
    .on("mouseover",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.SLOPE && i == selection)) {
        if (i > 0 && i < road.length-1) {
          d3.select(this)
            .attr("stroke-width",(opts.roadLine.width+2));
          highlightSlope(i, true);}}})
    .on("mouseout",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
         && !(selectType == br.RP.SLOPE && i == selection)) {
        if (i > 0 && i < road.length-1) {
          d3.select(this)
            .attr("stroke-width",opts.roadLine.width);
          highlightSlope(i, false);}}})
    .on("click", function(d,i) { 
      if (d3.event.ctrlKey) roadEdited(d, this.id);})
    .call(d3.drag()
          .on("start", function(d,i) { 
            if (i > 0 && i < road.length-1) 
              roadDragStarted(d, Number(this.id));})
          .on("drag", function(d,i) { 
            if (i > 0 && i < road.length-1) 
              roadDragged(d, Number(this.id));})
          .on("end", function(d,i) { 
            if (i > 0 && i < road.length-1) 
              roadDragEnded(d, Number(this.id));}));
}

function updateRoadData() {
  // Recompute dtd array and isolines for the newly edited road. Cannot rely on
  // the beebrain object since its road object will be set to the newly edited
  // road later, once dragging is finished. If this is the first time the goal
  // is being loaded, we can rely on the beebrain object's computation.
  dtd = processing ? gol.dtdarray : br.dtdarray(road, gol)
  iso = []
  // Precompute first few isolines for dotcolor etc to rely on (was 5 not 7)
  for (let i = 0; i < 7; i++) iso[i] = br.isoline( road, dtd, gol, i)
}

function updateRoadValidity() {
  if (processing || opts.divGraph == null || road.length == 0) return
  if (!opts.roadEditor) return
  
  const valid = isRoadValid( road )
  //var lineColor = valid?opts.roadLineCol.valid:opts.roadLineCol.invalid

  if (!valid) gRedTape.attr('visibility', 'visible')
  else gRedTape.attr('visibility', 'hidden')
  
  // Create, update and delete road lines
  //var roadelt = gRoads.selectAll(".roads")
  //roadelt.style("stroke",lineColor)

  //roadelt = ctxplot.selectAll(".ctxroads")
  //roadelt.style("stroke",lineColor)
}

function updateContextRoads() {
  if (processing || opts.divGraph == null || road.length == 0) return
  const lineColor = isRoadValid( road )?
        opts.roadLineCol.valid:opts.roadLineCol.invalid

  // Create, update and delete road lines for the brush 
  const roadelt = ctxplot.selectAll(".ctxroads").data(road);
  if (!opts.roadEditor) {
    roadelt.remove()
    return
  }
  roadelt.exit().remove()
  roadelt
    .attr("x1", function(d){ return xScB(d.sta[0]*SMS)})
    .attr("y1",function(d){ return yScB(d.sta[1])})
    .attr("x2", function(d){ return xScB(d.end[0]*SMS)})
    .attr("y2",function(d){ return yScB(d.end[1])})
    .style("stroke", lineColor);
  roadelt.enter()
    .append("svg:line")
    .attr("class","ctxroads")
    .attr("id", function(d,i) {return i})
    .attr("name", function(d,i) {return "ctxroad"+i})
    .attr("x1", function(d){ return xScB(d.sta[0]*SMS)})
    .attr("y1",function(d){ return yScB(d.sta[1])})
    .attr("x2", function(d){ return xScB(d.end[0]*SMS)})
    .attr("y2",function(d){ return yScB(d.end[1])})
    .style("stroke", lineColor)
    .style("stroke-width",opts.roadLine.ctxwidth)
}

function updateDots() {
  if (processing || opts.divGraph == null) return
  // Create, update and delete inflection points
  const dotelt = gDots.selectAll(".dots").data(road)
  if (!opts.roadEditor) {
    dotelt.remove()
    return
  }
  dotelt.exit().remove()
  dotelt
    .attr("cx", function(d) { return r1(nXSc(d.sta[0]*SMS)) })
    .attr("cy", function(d) { return r1(nYSc(d.sta[1])) })
  dotelt.enter().append("svg:circle")
    .attr("class","dots")
    .attr("id",   function(d,i) { return i-1 })
    .attr("name", function(d,i) { return "dot"+(i-1) })
    .attr("cx",   function(d) { return r1(nXSc(d.sta[0]*SMS)) })
    .attr("cy",   function(d)  { return r1(nYSc(d.sta[1])) })
    .attr("r", r3(opts.roadDot.size))
    .attr("fill", opts.roadDotCol.editable)
    .style("stroke-width", opts.roadDot.border) 
    .on('wheel', function(d) {
      // Redispatch a copy of the event to the zoom area
      const new_event = new d3.event.constructor(d3.event.type, d3.event)
      zoomarea.node().dispatchEvent(new_event)
      // Prevents mouse wheel event from bubbling up to the page
      d3.event.preventDefault()
    }, {passive:false})
    .on("mouseover",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
          && !(selectType == br.RP.VALUE && i-1 == selection)) {
        highlightValue(i-1, true)
        d3.select(this).attr("r", r3(opts.roadDot.size+2))
      }})
    .on("mouseout",function(d,i) { 
      if (!editingKnot && !editingDot && !editingRoad
          && !(selectType == br.RP.VALUE && i-1 == selection)) {
        highlightValue(i-1, false)
        d3.select(this).attr("r", r3(opts.roadDot.size))
      }})
    .on("click", function(d,i) { 
      if (d3.event.ctrlKey) dotEdited(d,this.id)})
    .call(d3.drag()
          .on("start", function(d,i) { 
            dotDragStarted(d, Number(this.id))})
          .on("drag", function(d,i) { 
            dotDragged(d, Number(this.id))})
          .on("end", function(d,i) { 
            dotDragEnded(d, Number(this.id))}))
}
  
function updateContextDots() {
  if (processing || opts.divGraph == null) return;
  // Create, update and delete inflection points
  const dotelt = ctxplot.selectAll(".ctxdots").data(road);
  if (!opts.roadEditor) {
    dotelt.remove();
    return;
  }
  dotelt.exit().remove();
  dotelt
    .attr("cx", function(d) { return r1(xScB(d.sta[0]*SMS)) })
    .attr("cy",function(d)  { return r1(yScB(d.sta[1])) })
  dotelt.enter().append("svg:circle")
    .attr("class","ctxdots")
    .attr("r", r3(opts.roadDot.ctxsize))
    .attr("fill", opts.roadDotCol.editable)
    .style("stroke-width", opts.roadDot.ctxborder)
    .attr("cx", function(d) { return r1(xScB(d.sta[0]*SMS)) })
    .attr("cy", function(d) { return r1(yScB(d.sta[1])) })
}

let styleLookup = {}
styleLookup[bu.BHUE.GRADOT] = " gra",
styleLookup[bu.BHUE.GRNDOT] = " grn",
styleLookup[bu.BHUE.BLUDOT] = " blu",
styleLookup[bu.BHUE.ORNDOT] = " orn",
styleLookup[bu.BHUE.REDDOT] = " red",
styleLookup[bu.BHUE.BLCK]   = " blk"

function dpStyle( pt ) {
  let sty = ""
  const col = br.dotcolor(road, gol, pt[0], pt[1], iso) 
  if (pt[3] != bbr.DPTYPE.AGGPAST) sty += " fuda"
  sty += styleLookup[col]
  return  sty
}
function dpFill( pt ) {
  return br.dotcolor(road, gol, pt[0], pt[1], iso)
}
function dpFillOp( pt ) {
  return (pt[3] == bbr.DPTYPE.AGGPAST)?null:0.3
}
function dpStrokeWidth( pt ) {
  return (((pt[3] == bbr.DPTYPE.AGGPAST)?1:0.5)*scf)+"px"
}

var dotTimer = null, dotText = null
function showDotText(d) {
  const ptx = nXSc(bu.daysnap(d[0])*SMS)
  const pty = nYSc(d[1])
  const txt = ((d[7]!=null)?"#"+d[7]+": ":"")          // datapoint index
      +moment.unix(d[0]).utc().format("YYYY-MM-DD")  // datapoint time
    +", "+((d[6] != null)?bu.shn(d[6]):bu.shn(d[1])) // datapoint original value
  if (dotText != null) rmTextBox(dotText)
  const info = []
  if (d[2] !== "") info.push("\""+d[2]+"\"")
  if (d[6] !== null && d[1] !== d[6]) info.push("total:"+d[1])
  var col = br.dotcolor(road, gol, d[0], d[1], iso)
  dotText = createTextBox(ptx, pty-(15+18*info.length), txt, col, info )
};
function removeDotText() { rmTextBox(dotText) }

// grp: Container group for the datapoints
  // d: data
  // cls: Class name for selection and creation
  // r: circle radius
  // s: stroke
  // sw: stroke-width
  // f: fill
  // hov: hover support (boolean)
  // fop: fill-opacity
  // nc: new element class
function updateDotGroup(grp,d,cls,nc=null,hov=true) {
  let dpelt

  if (nc == null) nc = cls // Temporary
  
  dpelt = grp.selectAll("."+cls).data(d)
  dpelt.exit().remove()
  dpelt
    .attr("cx", function(d) { return r1(nXSc((d[0])*SMS)) })
    .attr("cy", function(d) { return r1(nYSc(d[1])) })
    .attr("class", nc)
  
  var dots = dpelt.enter().append("svg:circle")
  
    dots.attr("class", nc)
      .attr("cx", function(d) { return r1(nXSc((d[0])*SMS)) })
      .attr("cy", function(d) { return r1(nYSc(d[1])) })
  if (!opts.headless) {
    dots
      .on('wheel', function(d) { 
        // Redispatch a copy of the event to the zoom area
        var new_event = new d3.event.constructor(d3.event.type, d3.event)
        zoomarea.node().dispatchEvent(new_event)
        // Prevents mouse wheel event from bubbling up to the page
        d3.event.preventDefault()
      }, {passive:false})
      .on("mouseenter",function(d) {
        if (opts.divData != null && opts.dataAutoScroll && d[7]!=null)
          selectDataIndex(d[7])
        if (dotTimer != null) window.clearTimeout(dotTimer);
        dotTimer = window.setTimeout(function() {
          showDotText(d); dotTimer = null;
        }, 500);})
      .on("mouseout",function() { 
        unselectDataIndex()
        if (dotText != null) {
          removeDotText();
          dotText = null;
        }
        window.clearTimeout(dotTimer); dotTimer = null;});
  }
}

function updateRosy() {
  if (processing || opts.divGraph == null || opts.roadEditor) return;

  var l = [nXSc.invert(0).getTime()/SMS, 
           nXSc.invert(plotbox.width).getTime()/SMS];
  var df = function(d) {
    return ((d[0] >= l[0] && d[0] <= l[1]) || (d[4] >= l[0] && d[4] <= l[1]));
  }

  // *** Plot rosy lines ***
  var rosyelt = gRosy.selectAll(".rosy")
  var rosydelt = gRosyPts.selectAll(".rd")
  if (opts.showData || !opts.roadEditor) {
    if (gol.rosy) {
      var pts = (bbr.flad != null)
          ?bbr.rosydata.slice(0,bbr.rosydata.length-1):bbr.rosydata
      var npts = pts.filter(df), i
      if (bbr.rosydata.length == 0) {
        // no points are in range, find enclosing two
        var ind = -1;
        for (i = 0; i < bbr.rosydata.length-1; i++) {
          if (bbr.rosydata[i][0]<=l[0]&&bbr.rosydata[i+1][0]>=l[1]) {
            ind = i; break;
          }
        }
        if (ind > 0) npts = bbr.rosydata.slice(ind, ind+2)
      }
      if (npts.length != 0) {
        let d = "M"+r1(nXSc(npts[0][4]*SMS))+" "+r1(nYSc(npts[0][5]))
        for (i = 0; i < npts.length; i++) {
          d += " L"+r1(nXSc(npts[i][0]*SMS))+" "+ r1(nYSc(npts[i][1]))
        }
        if (rosyelt.empty()) {
          gRosy.append("svg:path")
            .attr("class","rosy")
            .attr("d", d)
        } else
          rosyelt.attr("d", d)
          
      } else rosyelt.remove();
      // Rosy dots
      updateDotGroup(gRosyPts, npts, "rd", "rd", true)
    } else {
      rosyelt.remove()
      rosydelt.remove()
    }
  } else {
    rosyelt.remove()
    rosydelt.remove()
  }
}

function updateSteppy() {
  if (processing || opts.divGraph == null) return
  const xmin = nXSc.invert(            0).getTime()/SMS
  const xmax = nXSc.invert(plotbox.width).getTime()/SMS
  const df = function(d) {
    return d[0] >= xmin && d[0] <= xmax ||
           d[4] >= xmin && d[4] <= xmax
  }
  // *** Plot steppy lines ***
  let stpelt  = gSteppy.selectAll(".steppy")
  let stpdelt = gSteppyPts.selectAll(".std")
  if (opts.showData || !opts.roadEditor) {
    if (!opts.roadEditor && gol.steppy && dataf.length !== 0) {
      const npts = dataf.filter(df)
      let i
      if (npts.length === 0) {
        // no points are in range, find enclosing two
        let ind = -1
        for (i = 0; i < dataf.length-1; i++) {
          if (dataf[i][0]   <= xmin && 
              dataf[i+1][0] >= xmax) { ind = i; break }
        }
        if (ind > 0) npts = dataf.slice(ind, ind+2)
      }
      if (npts.length !== 0) {
        let d
        if (dataf[0][0] > xmin && 
            dataf[0][0] < xmax && 
            dataf[0][0] in bbr.allvals) {
          const vpre = bbr.allvals[dataf[0][0]][0][1] // initial datapoint
          d =  "M"+r1(nXSc(dataf[0][0]*SMS))+" "+r1(nYSc(vpre))
          d += " L"+r1(nXSc(npts[0][4]*SMS))+" "+r1(nYSc(npts[0][5]))
        } else {
          d =  "M"+r1(nXSc(npts[0][4]*SMS))+" "+r1(nYSc(npts[0][5]))
        }
        for (i = 0; i < npts.length; i++) {
          if (!nosteppy)
            d += " L"+r1(nXSc(npts[i][0]*SMS))+" "+ r1(nYSc(npts[i][5]))
          d += " L"+r1(nXSc(npts[i][0]*SMS))+" "+ r1(nYSc(npts[i][1]))
        }
        if (stpelt.empty()) {
          gSteppy.append("svg:path")
            .attr("class","steppy")
            .attr("d", d)
        } else
          stpelt.attr("d", d)

        // Need additional vertical steppy for do-less flatlined datapoints
        let stppprelt = gSteppy.selectAll(".steppyppr")
        if (bbr.flad !== null) {
          if (gol.yaw*gol.dir < 0 && gol.asof !== gol.tdat) {
            const fy = bbr.flad[1] + br.ppr(road, gol, gol.asof)
            d = "M"+r1(nXSc(npts[npts.length-1][0]*SMS))+" "
                   +r1(nYSc(npts[npts.length-1][1]))
            d+=" L"+r1(nXSc(npts[npts.length-1][0]*SMS))+" "+r1(nYSc(fy))
            if (stppprelt.empty()) {
              gSteppy.append("svg:path")
                .attr("class","steppyppr").attr("d", d)
            } else
              stppprelt.attr("d", d)
          } else stppprelt.remove()
        } else stppprelt.remove()
        
      } else stpelt.remove()
      // Steppy points
      updateDotGroup(gSteppyPts, bbr.flad ? npts.slice(0, npts.length-1) : npts,
                     "std", "std", true)
    } else {
      stpelt.remove()
      stpdelt.remove()
    }
  } else {
    stpelt.remove()
    stpdelt.remove()
  }
}

function updateDerails() {
  if (processing || opts.divGraph == null) return

  var l = [nXSc.invert(0).getTime()/SMS, 
           nXSc.invert(plotbox.width).getTime()/SMS]
  
  function ddf(d) {// Filter to extract derailments
    return (d[0] >= l[0] && d[0] <= l[1])
  }

  var drelt
  // *** Plot derailments ***
  if (opts.showData || !opts.roadEditor) {
    var drpts = bbr.derails.filter(ddf)
    var arrow = (gol.yaw>0)?"#downarrow":"#uparrow"
    drelt = gDerails.selectAll(".derails").data(drpts)
    drelt.exit().remove()
    drelt
      .attr("transform", function(d){return "translate("+(nXSc((d[0])*SMS))+","
                                      +nYSc(d[1])+"),scale("
                                      +(opts.dataPoint.fsize*scf/24)+")"})
  
    drelt.enter().append("svg:use")
      .attr("class","derails")
      .attr("xlink:href", arrow)
      .attr("transform", function(d){return "translate("+(nXSc((d[0])*SMS))+","
                                      +nYSc(d[1])+"),scale("
                                      +(opts.dataPoint.fsize*scf/24)+")"})
  } else {
    drelt = gDerails.selectAll(".derails")
    drelt.remove()
  }        
}

function updateDataPoints() {
  if (processing || opts.divGraph == null || road.length == 0) return
  //console.debug("id="+curid+", updateDataPoints()");
  var l = [nXSc.invert(0).getTime()/SMS, 
           nXSc.invert(plotbox.width).getTime()/SMS]
  // Filter to apply to normal datapoints
  var df = function(d) {
    return ((d[0] >= l[0] && d[0] <= l[1]) || (d[4] >= l[0] && d[4] <= l[1]))
  }
  // Filter to apply to all datapoints
  var adf = function(d) {
    return (d[0] >= l[0] && d[0] <= l[1])
  }
  var now = gol.asof
  var dpelt
  if (opts.showData || !opts.roadEditor) {
    var pts = bbr.flad != null ? dataf.slice(0, dataf.length-1) : dataf
    
    // *** Plot datapoints ***
    // Filter data to only include visible points
    pts = pts.filter(df);
    if (gol.plotall && !opts.roadEditor) {
      // All points
      updateDotGroup(gAllpts, alldataf.filter(adf), "ap", d=>("ap"+dpStyle(d)), true)
      
    } else {
      var el = gAllpts.selectAll(".ap");
      el.remove();
    }
    if (opts.roadEditor)
      updateDotGroup(gDpts, pts.concat(bbr.fuda), "dp", d=>("dp"+dpStyle(d)), true)
    else {
      updateDotGroup(gDpts, pts.concat(bbr.fuda), "dp", d=>("dp"+dpStyle(d)), true)
      // hollow datapoints
      updateDotGroup(gHollow, bbr.hollow.filter(df), "hp", d=>("hp"+dpStyle(d)), true)
    }
      
    // *** Plot flatlined datapoint ***
    var fladelt = gFlat.selectAll(".fladp");
    if (bbr.flad != null) {
      const ppr = br.ppr(road, gol, gol.asof)
      const flady = bbr.flad[1] + ppr
      const fop = ppr == 0 ? 1.0 : 0.5 // ghosty iff there's a PPR
      if (fladelt.empty()) {
        gFlat.append("svg:use")
          .attr("class","fladp").attr("xlink:href", "#rightarrow")
          .attr("fill", br.dotcolor(road,gol,bbr.flad[0],flady, iso))
          .attr("fill-opacity", fop)
          .attr("transform", "translate("+(nXSc((bbr.flad[0])*SMS))+","
                +nYSc(flady)+"),scale("+(opts.dataPoint.fsize*scf/24)+")")
          .style("pointer-events", function() {
            return (opts.roadEditor)?"none":"all";})
          .on("mouseenter",function() {
            if (dotTimer != null)  window.clearTimeout(dotTimer);
            dotTimer = window.setTimeout(function() {
              showDotText(bbr.flad); dotTimer = null;}, 500);})
          .on("mouseout",function() { 
            if (dotText != null) { removeDotText(); dotText = null; }
            window.clearTimeout(dotTimer); 
            dotTimer = null;});
      } else {
        fladelt
          .attr("fill", br.dotcolor(road,gol,bbr.flad[0],flady, iso))
          .attr("fill-opacity", fop)
          .attr("transform", 
                "translate("+(nXSc((bbr.flad[0])*SMS))+","
                +nYSc(flady)+"),scale("
                +(opts.dataPoint.fsize*scf/24)+")");
      }
    } else {
      if (!fladelt.empty()) fladelt.remove()
    }
    
  } else {
    dpelt = gDpts.selectAll(".dp");
    dpelt.remove();
    fladelt = gDpts.selectAll(".fladp");
    fladelt.remove();
  }
}

function updateHashtags() {
  if (processing || opts.divGraph == null) return
  
  var hashel
  //if (!opts.roadEditor) {
    hashel = gHashtags.selectAll(".hashtag").data(bbr.hashtags);
    hashel.exit().remove();
    hashel
      .attr("x", function(d){ return nXSc((d[0])*SMS);})
      .attr("transform", d=>("rotate(-90,"+nXSc((d[0])*SMS)
                             +","+(plotbox.height/2)+")"))
      .text(d=>(d[1]))
    hashel.enter().append("svg:text")
      .attr("class","hashtag")
      .attr("x", d=>(nXSc((d[0])*SMS)))
      .attr("y", plotbox.height/2)
      .attr("transform", 
        d => ("rotate(-90,"+nXSc((d[0])*SMS)+","+(plotbox.height/2)+")"))
      .attr("fill", bu.BHUE.BLACK) 
      .style("font-size", opts.horizon.font+"px") 
      .text(d => (d[1]))
    
  //} else {
  //  hashel = gHashtags.selectAll(".hashtag")
  //  hashel.remove()
  //}
}


// Other ideas for data smoothing...  Double Exponential
// Moving Average: http://stackoverflow.com/q/5533544 Uluc
// notes that we should use an acausal filter to prevent the
// lag in the thin purple line.
function updateMovingAv() {
  if (processing) return;
  
  var el = gMovingAv.selectAll(".movingav");
  if (!opts.roadEditor && gol.movingav && opts.showData) {
    var l = [nXSc.invert(0).getTime()/SMS, 
             nXSc.invert(plotbox.width).getTime()/SMS];
    var rdfilt = function(r) {
      return ((r.sta[0] > l[0] && r.sta[0] < l[1])
              || (r.end[0] > l[0] && r.end[0] < l[1]));
    };
    var pts = gol.filtpts.filter(function(e){
      return (e[0] > l[0]-2*SID && e[0] < l[1]+2*SID);});
    if (pts.length > 0){
      var d = "M"+r1(nXSc(pts[0][0]*SMS))+" "+r1(nYSc(pts[0][1]))
      for (let i = 1; i < pts.length; i++) {
        d += " L"+r1(nXSc(pts[i][0]*SMS))+" "+r1(nYSc(pts[i][1]))
      }
      if (el.empty()) {
        gMovingAv.append("svg:path")
          .attr("class","movingav")
          .attr("d", d)
          .style("fill", "none")
          .attr("stroke-width",r3(3*scf)) // go thicker: 3 -> 5
          .style("stroke", bu.BHUE.PURP)  // Uluc tried ROSE but not sure
      } else {
        el.attr("d", d)
          .attr("stroke-width",r3(3*scf)) // go thicker: 3 -> 5
      }
    } else el.remove();
  } else {
    el.remove();
  }
}

// Create the table header and body to show road segments
var tcont, thead, tbody;
function createRoadTable() {
  d3.select(opts.divTable).attr("class", "bmndrroad")
  // The main road table doe not have a header
  tcont = d3.select(opts.divTable).select(".rtbmain");
  thead = d3.select(opts.divTable).select(".rtable");
  tbody = thead.append('div').attr('class', 'roadbody');
}

// Create the table header and body to show the start node
var sthead, stbody, sttail
const rtbccls = ["dt", "vl", "sl"]
function createStartTable() {
  var startcolumns, tailcolumns;
  if (opts.roadEditor) {
    startcolumns = ['', 'Start Date', 'Value', '', '']
    tailcolumns = ['', 'End Date', 'Value', 'Daily Slope', '']
  } else {
    startcolumns = ['', 'Start Date', 'Value', '']
    tailcolumns = ['', 'End Date', 'Value', 'Daily Slope']
  }    
  sthead = d3.select(opts.divTable).select(".rtbstart")
  sthead.append("div").attr('class', 'roadhdr')
    .append("div").attr('class', 'roadhdrrow')
    .selectAll("span.rdhdrcell").data(startcolumns)
    .enter().append('span').attr('class', (d,i)=>('rdhdrcell '+rtbccls[i]))
    .text((c)=>c);
  stbody = sthead.append('div').attr('class', 'roadbody'); 
  sttail = sthead.append("div").attr('class', 'roadhdr');
  sttail.append("div").attr('class', 'roadhdrrow')
    .selectAll("span.rdhdrcell").data(tailcolumns)
    .enter().append('span').attr('class', (d,i)=>('rdhdrcell '+rtbccls[i]))
    .text((c)=>c);
}

// Create the table header and body to show the goal node
var ghead, gbody
function createGoalTable() {
  var goalcolumns
  if (opts.roadEditor)
    goalcolumns = ['', 'Goal Date', 'Value', 'Daily Slope', '', '']
  else goalcolumns = ['', 'Goal Date', 'Value', 'Daily Slope']

  ghead = d3.select(opts.divTable).select(".rtbgoal");
  ghead.append("div").attr('class', 'roadhdr')
    .append("div").attr('class', 'roadhdrrow')
    .selectAll("span.rdhdrcell").data(goalcolumns)
    .enter().append('span').attr('class', (d,i)=>('rdhdrcell '+rtbccls[i]))
    .text((c)=>c)
  gbody = ghead.append('div').attr('class', 'roadbody');
}

function updateTableTitles() {
  if (opts.divTable == null) return;
  var ratetext = "Daily Slope";
  if (gol.runits === 'h') ratetext = "Hourly Slope";
  if (gol.runits === 'd') ratetext = "Daily Slope";
  if (gol.runits === 'w') ratetext = "Weekly Slope";
  if (gol.runits === 'm') ratetext = "Monthly Slope";
  if (gol.runits === 'y') ratetext = "Yearly Slope";

  var roadcolumns, goalcolumns
  if (opts.roadEditor) {
    roadcolumns = ['', 'End Date',  'Value', ratetext, '', '']
    goalcolumns = ['', 'Goal Date', 'Value', ratetext, '', '']
  } else {
    roadcolumns = ['', 'End Date',  'Value', ratetext]
    goalcolumns = ['', 'Goal Date', 'Value', ratetext]
  }    
  sttail.selectAll("span.rdhdrcell").data(roadcolumns).text((c)=>c)
  thead.selectAll("span.rdhdrcell").data(roadcolumns).text((c)=>c)
  ghead.selectAll("span.rdhdrcell").data(goalcolumns).text((c)=>c)

  updateTableWidths()
}

let datePicker = null
function destroyDatePicker() {
  if (datePicker != null) {
    if (datePicker.picker) datePicker.picker.destroy()
    datePicker = null
  }
}

// flt: floating element that will contain the date picker
// tl: absolutely positioned "topleft" element that will act as a reference for the floating element,
// fld: d3 selection for the field that holds the date
function createDatePicker(fld, min, max, flt, tl) {
  console.log("createDatePicker()"+min)
  destroyDatePicker()
  datePicker = {
    min: min,
    max: max,
    flt: flt,
    tl: tl,
    fld: fld,
    oldText: fld.text()
  }
  if (onMobileOrTablet()) {
    // Some sort of workaround on mobile browser focus behavior?
    fld.attr("contenteditable", false)
    setTimeout(function() {
      fld.attr("contenteditable", true)}, 100);
  }
  let md = moment(datePicker.oldText)
  datePicker.picker = new Pikaday({
    keyboardInput: false,
    onSelect: function(date) {
      var newdate = datePicker.picker.toString()
      var val = bu.dayparse(newdate, '-')
      if (newdate === datePicker.oldText) return
      if (!isNaN(val)) {
        datePicker.fld.text(newdate)
        datePicker.oldText = newdate
        destroyDatePicker()
        document.activeElement.blur()
      }
    },
    minDate: min,
    maxDate: max
  })
  datePicker.picker.setMoment(md)
  var bbox = fld.node().getBoundingClientRect();
  var tlbox = tl.node().getBoundingClientRect();
  flt
    .style('left', (bbox.right-tlbox.left)+"px")
    .style('top', (bbox.bottom+3-tlbox.top)+"px");
  flt.node().appendChild(datePicker.picker.el, fld.node())
}
   
// Focused field information for the road table
let rdFocus = {
  field: null,
  oldText : null,
}
   
function tableFocusIn( d, i ){
  if (!opts.roadEditor) return;
  console.debug('tableFocusIn('+i+') for '+this.parentNode.id);
  rdFocus.field = d3.select(this);
  rdFocus.oldText = rdFocus.field.text();
  destroyDatePicker()

  var kind = Number(rdFocus.field.node().parentNode.id);
  if (selection != null) clearSelection();
  if (i == 0) {
    selectKnot(kind, false)

    var knotmin = (kind == 0) ? gol.xMin-10*SID*DIY : (road[kind].sta[0])
    var knotmax = (kind == road.length-1) ? road[kind].end[0]
                                          : (road[kind+1].end[0])
    // Switch all dates to local time to babysit Pikaday
    var mindate = moment(moment.unix(knotmin).utc().format("YYYY-MM-DD"))
    var maxdate = moment(moment.unix(knotmax).utc().format("YYYY-MM-DD"))
    var floating = d3.select(opts.divTable).select('.floating');
    createDatePicker(rdFocus.field, mindate.toDate(), maxdate.toDate(), floating, topLeft)
  } else if (i == 1) {
    selectDot(kind, false)
  } else if (i == 2) {
    selectRoad(kind, false)
  }
}

function tableFocusOut( d, i ){
  if (!opts.roadEditor) return;
  //console.debug('tableFocusOut('+i+') for '+this.parentNode.id);
  let kind = Number(this.parentNode.id)
  let text = d3.select(this).text()
  destroyDatePicker()
  clearSelection()
  if (text === rdFocus.oldText) return
  if (rdFocus.oldText == null) return // ENTER must have been hit
  let val = (i==0 ? bu.dayparse(text, '-') : text)
  if (isNaN(val)) {
    d3.select(this).text(rdFocus.oldText)
    rdFocus.oldText = null
    rdFocus.field = null
    return
  }
  if (i == 0) { tableDateChanged(  kind, val);  clearSelection() }
  if (i == 1) { tableValueChanged( kind, val);  clearSelection() }
  if (i == 2) { tableSlopeChanged( kind, val);  clearSelection() }
  rdFocus.oldText = null
  rdFocus.field = null
}
function tableKeyDown( d, i ){
  if (d3.event.keyCode == 13) {
    window.getSelection().removeAllRanges()
    var text = d3.select(this).text()
    var val = (i==0 ? bu.dayparse(text, '-') : text)
    if (isNaN(val)) {
      d3.select(this).text(rdFocus.oldText)
      rdFocus.oldText = null
      return
    }
    if (i == 0) tableDateChanged(  Number(this.parentNode.id), val)
    if (i == 1) tableValueChanged( Number(this.parentNode.id), val)
    if (i == 2) tableSlopeChanged( Number(this.parentNode.id), val)
    rdFocus.oldText = d3.select(this).text()
  }
}
function tableClick( d, i ){
  var id = Number(this.parentNode.id)
  if (opts.roadEditor && i == road[id].auto) {
    if (i == 0) disableValue(id)
    else if (i == 1) disableSlope(id)
    else if (i == 2) disableDate(id)
    this.focus()
  }
}

function tableDateChanged( row, value ) {
  //console.debug("tableDateChanged("+row+","+value+")");
  if (isNaN(value)) updateTableValues();
  else changeKnotDate( row, Number(value), true );
}
function tableValueChanged( row, value ) {
  //console.debug("tableValueChanged("+row+","+value+")");
  if (isNaN(value)) updateTableValues();
  else changeDotValue( row, Number(value), true );
}
function tableSlopeChanged( row, value ) {
  //console.debug("tableSlopeChanged("+row+")");
  if (isNaN(value)) updateTableValues();
  else changeRoadSlope( row, Number(value), true );
}

  function autoScroll( elt, force = true ) {
  if (opts.tableAutoScroll && selection == null && opts.tableHeight !== 0) {
    let rect = elt.node().parentNode.getBoundingClientRect()
    if (rect.height == 0) return // Table is most likely invisible
    let eltdata = elt.data(), eh = (rect.height+1)//+1 table border-spacing
    let eind = (eltdata[0].i-1),  topPos = eind*eh
    if (opts.divTable != null) {
      let nd = tcont.node()
      let offset = (eind - Math.floor(nd.scrollTop / eh))*eh
      if (force || (offset < 0 || offset-eh > opts.tableHeight))
        nd.scrollTop = topPos-opts.tableHeight/2
    }
  }
}
/** Highlights the date for the ith knot if state=true. Normal color otherwise*/
function highlightDate(i, state, scroll = true) {
  if (opts.divTable == null) return;
  let color = (state)
      ?opts.roadTableCol.bgHighlight:
      (road[i].auto==0?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
  let elt = d3.select(opts.divTable)
      .select('.roadrow [name=enddate'+i+']');
  if (elt.empty()) return;
  elt.style('background-color', color);
  if (scroll && state) autoScroll(elt);
}
function highlightValue(i, state, scroll = true) {
  if (opts.divTable == null) return;
  var color = (state)
        ?opts.roadTableCol.bgHighlight:
        (road[i].auto==1?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
  var elt = d3.select(opts.divTable)
        .select('.roadrow [name=endvalue'+i+']');
  if (elt.empty()) return;
  elt.style('background-color', color);
  if (scroll && state) autoScroll(elt);
}
function highlightSlope(i, state, scroll = true) {
  if (opts.divTable == null) return;
  var color = (state)
        ?opts.roadTableCol.bgHighlight:
        (road[i].auto==2?opts.roadTableCol.bgDisabled:opts.roadTableCol.bg);
  var elt = d3.select(opts.divTable)
        .select('.roadrow [name=slope'+i+']');
  if (elt.empty()) return;
  elt.style('background-color', color);  
  if (scroll && state) autoScroll(elt);
}
function disableDate(i) {
  road[i].auto=br.RP.DATE;
  var dt = d3.select(opts.divTable);
  dt.select('.roadrow [name=enddate'+i+']')
    .style('color', opts.roadTableCol.textDisabled)
    .style('background-color', opts.roadTableCol.bgDisabled)
    .attr('contenteditable', false);  
  dt.select('.roadrow [name=endvalue'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=slope'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=btndate'+i+']')
    .property('checked', true);  
  dt.select('.roadrow [name=btnvalue'+i+']')
    .property('checked', false);  
  dt.select('.roadrow [name=btnslope'+i+']')
    .property('checked', false);  
}
function disableValue(i) {
  road[i].auto=br.RP.VALUE;
  var dt = d3.select(opts.divTable);
  dt.select('.roadrow [name=enddate'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=endvalue'+i+']')
    .style('color', opts.roadTableCol.textDisabled)
    .style('background-color', opts.roadTableCol.bgDisabled)
    .attr('contenteditable', false);  
  dt.select('.roadrow [name=slope'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=btndate'+i+']')
    .property('checked', false);  
  dt.select('.roadrow [name=btnvalue'+i+']')
    .property('checked', true);  
  dt.select('.roadrow [name=btnslope'+i+']')
    .property('checked', false);  
}
function disableSlope(i) {
  road[i].auto=br.RP.SLOPE;
  var dt = d3.select(opts.divTable);
  dt.select('.roadrow [name=enddate'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=endvalue'+i+']')
    .style('color', opts.roadTableCol.text)
    .style('background-color', opts.roadTableCol.bg)
    .attr('contenteditable', opts.roadEditor);  
  dt.select('.roadrow [name=slope'+i+']')
    .style('color', opts.roadTableCol.textDisabled)
    .style('background-color', opts.roadTableCol.bgDisabled)
    .attr('contenteditable', false);  
  dt.select('.roadrow [name=btndate'+i+']')
    .property('checked', false);  
  dt.select('.roadrow [name=btnvalue'+i+']')
    .property('checked', false);  
  dt.select('.roadrow [name=btnslope'+i+']')
    .property('checked', true);  
}

function updateTableButtons() {
  if (opts.divTable == null) return
  // Update buttons on all rows at once, including the start node.
  var allrows = d3.select(opts.divTable)
        .selectAll(".rtbstart .roadrow, .rtable .roadrow, .rtbgoal .roadrow")
  var btncells = allrows.selectAll(".rdbtn")
        .data(function(row, i) {
          // The table row order is reversed, which means that the
          // last road segment comes in the first row.  We need to
          // compute knot index accordingly
          var kind
          if (opts.reverseTable) kind = road.length-2-i
          else kind = i
          return [
            {order: 8, row:kind, name: "btndel"+kind, evt: ()=>removeKnot(kind,true), 
             type: 'button', txt: '<img class="ricon" src="../src/trash.svg" ></img>', auto: false},
            {order: 9, row:kind, name: "btnadd"+kind, evt: ()=>addNewKnot(kind+1),
             type: 'button', txt: '<img class="ricon" src="../src/plus.svg"></img>', auto: false},
          ];
        })
  
  var newbtncells = btncells.enter().append("button")
      .attr('class', (d)=>('rdbtn '+d.txt))
      .attr('id',   (d) => d.row)
      .attr('name', (d) => d.name)
      .html((d) => { 
        return d.txt
      })
      .on('click', (d) => d.evt())
  
  btncells.exit().remove()
  btncells = allrows.selectAll(
    ".rtbstart .rdbtn, .rtable .rdbtn, .rtbgoal .rdbtn")
  btncells
    .attr('id', (d)=>d.row)
    .attr('name', (d)=>d.name)
    .style('display', (d,i) =>
           (((Number(d.row)>0 && Number(d.row)<(road.length-2)) 
             || i==4 
             || (i>0 && Number(d.row)>0 ))?null:"none")
          )

  allrows.selectAll(".rdcell, .rdbtn")
    .sort((a,b)=>d3.ascending(a.order,b.order))

  if (!opts.roadEditor) {
    allrows.selectAll(".rdbtn").style('display', "none")
      .attr("value","")
  }
}

function updateRowValues( elt, s, e, rev ) {
  var data = road.slice(s, e)
  if (rev) data = data.reverse()
  var rows = elt.selectAll(".roadrow").data( data )
  var ifn = (i)=>(rev?(road.length-2-i):i)
  rows.enter().append("div").attr('class', 'roadrow')
    .attr("name", (d,i)=>('roadrow'+ifn(s+i)))
    .attr("id", (d,i)=>(ifn(s+i)))
    .append("div")
    .attr("class", "rowid").text((d,i)=>(ifn(s+i)+":"))
  rows.exit().remove()
  rows.order()
  rows = elt.selectAll(".roadrow")
  rows.attr("name", (d,i)=>('roadrow'+ifn(s+i)))
    .attr("id", (d,i)=>(ifn(s+i)))
  rows.select("div").text((d,i)=>(ifn(s+i)+":"))
  var cells = rows.selectAll(".rdcell")
      .data((row, i) => {
        var datestr = bu.dayify(row.end[0], '-')
        var ri = ifn(s+i)
        return [
          {order: 2, value: datestr, name: "enddate"+(ri), 
           auto: (row.auto==br.RP.DATE), i:ri},
          {order: 4, value: bu.shn(row.end[1]), name: "endvalue"+(ri), 
           auto: (row.auto==br.RP.VALUE), i:ri},
          {order: 6, value: isNaN(row.slope)
           ?"duplicate":bu.shn(row.slope*gol.siru), name: "slope"+(ri), 
           auto: (row.auto==br.RP.SLOPE), i:ri}]
      });
   cells.enter().append("div").attr('class', (d,i)=>('rdcell '+rtbccls[i]))
    .attr('name', (d)=>d.name)
    .attr("contenteditable", 
      (d,i) =>((d.auto || !opts.roadEditor)?'false':'true'))
    .on('click', tableClick)
    .on('focusin', tableFocusIn)
    .on('focusout', tableFocusOut)
    .on('keydown', tableKeyDown)

   cells.exit().remove()
   cells = rows.selectAll(".rdcell")
   cells.text((d,i)=>d.value)
     .attr('name', (d)=>d.name)
    .style('color', (d) =>{
      if (road[d.i].sta[0] == road[d.i].end[0] 
          && road[d.i].sta[1] == road[d.i].end[1])
        return opts.roadLineCol.invalid
      return d.auto?opts.roadTableCol.textDisabled
        :opts.roadTableCol.text})
    .style('background-color', function(d) {
      return d.auto?opts.roadTableCol.bgDisabled
        :opts.roadTableCol.bg})
    .attr("contenteditable", function(d,i) { 
      return (d.auto || !opts.roadEditor)?'false':'true'})
}

function updateTableWidths() {
  if (opts.divTable == null || hidden) return;
  if (road.length > 3) {
    if (!tbody.node().offsetParent) return
    d3.select(opts.divTable)
      .style("width", (tbody.node().offsetWidth+35)+"px")
    
  } else {
    if (!gbody.node().offsetParent) return
    d3.select(opts.divTable)
      .style("width", (gbody.node().offsetWidth+35)+"px")
  }
}

function updateTableValues() {
  if (opts.divTable == null) return

  var reversetable = opts.reverseTable

  updateRowValues( stbody, 0, 1, false )
  stbody.select("[name=slope0]")
    .style("visibility","hidden")
    .style("pointer-events","none")
    .style("border", "1px solid transparent")

  updateRowValues( tbody, 1, road.length-2, reversetable )
  updateRowValues( gbody, road.length-2, road.length-1, false )

  if (road.length <=3) {
    sttail.style("visibility", "collapse")
    d3.select(opts.divTable).select(".rtbmain").style("display", "none")
  } else {
    sttail.style("visibility", null)
    d3.select(opts.divTable).select(".rtbmain").style("display", null)
  }

  updateTableWidths()
}

/** Updates table */
function updateTable() {
  updateTableValues()
  updateTableButtons()
  updateTableWidths()
}

function updateContextData() {
  if (opts.divGraph == null) return

  if (opts.showContext) {
    context.attr("visibility", "visible")
    updateContextOldRoad()
    updateContextOldBullseye()
    updateContextBullseye()
    updateContextRoads()
    updateContextDots()
    updateContextHorizon()
    updateContextToday()
    if (opts.showFocusRect) focusrect.attr("visibility", "visible")
    else focusrect.attr("visibility", "hidden")
  } else {
    context.attr("visibility", "hidden")
    focusrect.attr("visibility", "hidden")
  }
}


// Updates style info embedded in the SVG element for datapoints.
// This is called once at the beginning and whenever scf changes
function updateDynStyles() {
  let s = "", svgid = "#svg"+curid+" "
  let pe = "pointer-events:"+((opts.headless)?"none;":"all;")
  
  s += svgid+".rd {r:"+r3(opts.dataPoint.size*scf)+"px} "
  s += svgid+".std {r:"+r3((opts.dataPoint.size+2)*scf)+"px} "
  s += svgid+".ap {r:"+r3(0.7*(opts.dataPoint.size)*scf)+"px;"+pe+"} "
  s += svgid+".hp {r:"+r3(opts.dataPoint.hsize*scf)+"px;"+pe+"} "
  s += svgid+".guides {stroke-width:"+r3(opts.guidelines.width*scf)+"px} "
  s += svgid+".rosy {stroke-width:"+r3(4*scf)+"px} "
  s += svgid+".steppy {stroke-width:"+r3(4*scf)+"px} "
  s += svgid+".steppyppr {stroke-width:"+r3(4*scf)+"px} "
  s += svgid+".maxflux {fill:none;stroke:"+bu.BHUE.BIGG+";stroke-width:"+r3(opts.maxfluxline*scf)+"px} "
  s += svgid+".stdflux {fill:none;stroke:"+bu.BHUE.BIGG+";stroke-width:"+r3(opts.stdfluxline*scf)+"px} "
  s += svgid+".axis text {font-size:"+opts.axis.font+"px;} "
  s += svgid+".axislabel {font-size:"+opts.axis.font+"px;} "
  // Styles that depend on the road editor
  if (opts.roadEditor) {
    // Datapoints
    s += svgid+".dp {r:"+r3(opts.dataPoint.size*scf)+"px;stroke:"
      +opts.dataPointCol.stroke+";stroke-width:"+r3(opts.dataPoint.border*scf)+"px} "
    s += svgid+".razr {fill:none;pointer-events:none;stroke-width:"+r3(opts.razrline*scf)+"px;stroke:"+bu.BHUE.RAZR0+"} "
  } else {
    s += svgid+".dp {r:"+r3(opts.dataPoint.size*scf)+"px;stroke:rgb(0,0,0);stroke-width:"+r3(1*scf)+"px} "
    s += svgid+".dp.fuda {stroke-width:"+r3(0.5*scf)+"px} "
    s += svgid+".razr {fill:none;pointer-events:none;stroke-width:"+r3(opts.razrline*scf)+"px;stroke:"+bu.BHUE.REDDOT+"} "
  }
  d3.select("style#dynstyle"+curid).text(s)
}

function updateGraphData(force = false) {
  if (opts.divGraph == null) return
  clearSelection()
  const limits = [nXSc.invert(            0).getTime()/SMS, 
                  nXSc.invert(plotbox.width).getTime()/SMS]
  if (force) oldscf = 0
  scf = opts.roadEditor ? 
    bu.clip(bu.rescale(limits[1], limits[0],limits[0]+73*SID, 1,.7 ), .7,  1) :
    bu.clip(bu.rescale(limits[1], limits[0],limits[0]+73*SID, 1,.55), .55, 1)

  if (scf != oldscf) updateDynStyles()
  
  //updateRoadData()
  updateRoadValidity()
  updateWatermark()
  updatePastBox()
  updateYBHP()
  updatePinkRegion()
  updateGuidelines()
  updateRazrRoad()
  updateMaxFluxline()
  updateStdFluxline()
  updateOldBullseye()
  updateBullseye()
  updateKnots()
  updateDataPoints()
  updateDerails()
  updateRosy()
  updateSteppy()
  updateHashtags()
  updateMovingAv()
  updateRoads()
  updateDots()
  updateHorizon()
  updateOdomResets()
  updatePastText()
  updateAura()
  // Record current dot color so it can be retrieved from the SVG
  // for the thumbnail border
  zoomarea.attr('color', br.dotcolor(road, gol, gol.tcur, gol.vcur, iso))

  // Store the latest scale factor for comparison. Used to
  // eliminate unnecessary attribute setting for updateDotGroup
  // and other update functions
  oldscf = scf
}

createGraph()
createTable()
createDueBy()
createDataTable()
//zoomAll()

/** bgraph object ID for the current instance */
this.id = 1

/** Sets/gets the showData option 
 @param {Boolean} flag Set/reset the option*/
this.showData = (flag) => {
  if (arguments.length > 0) opts.showData = flag
  if (alldata.length != 0) {
    updateDataPoints()
    updateDerails()
    updateRosy()
    updateSteppy()
    updateMovingAv()
    updateAura()
  }
  return opts.showData
}

/** Sets/gets the showContext option 
 @param {Boolean} flag Set/reset the option */
this.showContext = (flag) => {
  if (arguments.length > 0) opts.showContext = flag
  if (road.length != 0)
    updateContextData()
  return opts.showContext
}

/** Sets/gets the keepSlopes option 
 @param {Boolean} flag Set/reset the option */
this.keepSlopes = (flag) => {
  if (arguments.length > 0) opts.keepSlopes = flag
  return opts.keepSlopes
}

/** Sets/gets the keepIntervals option 
 @param {Boolean} flag Set/reset the option */
this.keepIntervals = ( flag ) => {
  if (arguments.length > 0) opts.keepIntervals = flag
  return opts.keepIntervals
}

/** Sets/gets the maxDataDays option. Updates the datapoint
 display if the option is changed. */
this.maxDataDays = ( days ) => {
  if (arguments.length > 0) {
    opts.maxDataDays = days
    if (opts.maxDataDays < 0) {
      alldataf = alldata.slice()
      dataf = data.slice()
    } else {
      alldataf = alldata.filter((e)=>(e[0]>(gol.asof-opts.maxDataDays*SID)))
      dataf = data.filter((e)=>(e[0]>(gol.asof-opts.maxDataDays*SID)))
    }
    if (alldata.length != 0) {
      updateDataPoints()
      updateDerails()
      updateRosy()
      updateSteppy()
    }
  }
  return opts.maxDataDays
}

/** Sets/gets the reverseTable option. Updates the table if
 the option is changed.  
 @param {Boolean} flag Set/reset the option*/
this.reverseTable = ( flag ) => {
  if (arguments.length > 0) {
    opts.reverseTable = flag
    if (opts.reverseTable) {
      d3.select(opts.divTable).select(".rtbgoal").raise()
      d3.select(opts.divTable).select(".rtbmain").raise()
      d3.select(opts.divTable).select(".rtbstart").raise()
    } else {
      d3.select(opts.divTable).select(".rtbstart").raise()
      d3.select(opts.divTable).select(".rtbmain").raise()
      d3.select(opts.divTable).select(".rtbgoal").raise()
    }
    updateTable()
  }
  return opts.reverseTable
}

/** Sets/gets the tableUpdateOnDrag option. 
 @param {Boolean} flag Set/reset the option */
this.tableUpdateOnDrag = ( flag ) => {
  if (arguments.length > 0) {
    opts.tableUpdateOnDrag = flag
    updateTable()
  }
  return opts.tableUpdateOnDrag
}

/** Sets/gets the tableAutoScroll option.  
 @param {Boolean} flag Set/reset the option*/
this.tableAutoScroll = ( flag ) => {
  if (arguments.length > 0) opts.tableAutoScroll = flag
  return opts.tableAutoScroll
}

/** Returns an object with the lengths of the undo and redo
 buffers */
this.undoBufferState = () => {
  return({undo: undoBuffer.length, redo: redoBuffer.length})
}

/** Undoes the last edit */
this.undo = () => {
  if (!opts.roadEditor) return
  document.activeElement.blur()
  undoLastEdit()
}

/** Undoes all edits */
this.undoAll = () => {
  if (!opts.roadEditor) return
  road = undoBuffer.shift()
  clearUndoBuffer()
  bbr.setRoadObj(road) // Since popped version is a copy, must inform beebrain
  roadChanged()
}

/** Redoes the last edit that was undone */
this.redo = () => {
  if (!opts.roadEditor) return
  document.activeElement.blur()
  redoLastEdit()
}

/** Clears the undo buffer. May be useful after the new
 road is submitted to Beeminder and past edits need to be
 forgotten.*/
this.clearUndo = clearUndoBuffer

/** Zooms out the goal graph to make the entire range from
 tini to tfin visible, with additional slack before and after
 to facilitate adding new knots. */
this.zoomAll = () => { if (road.length == 0) return; else zoomAll() }

/** Brings the zoom level to include the range from tini to
 slightly beyond the akrasia horizon. This is expected to be
 consistent with beebrain generated graphs. */ 
this.zoomDefault = () => { if (road.length == 0) return; else zoomDefault() }

/** Initiates loading a new goal from the indicated url.
 Expected input format is the same as beebrain. Once the input
 file is fetched, the goal graph and graph matrix table are
 updated accordingly. 
@param {String} url URL to load the goal BB file from*/
this.loadGoal = async ( url ) => {
  await loadGoalFromURL( url )
    .catch(function(err){
      console.log(err.stack)
    })
}

/** Initiates loading a new goal from the supplied object.
 Expected input format is the same as beebrain. The goal graph and
 graph matrix table are updated accordingly.
@param {object} json Javascript object containing the goal BB file contents*/
this.loadGoalJSON = ( json, timing = true ) => {
  removeOverlay()
  loadGoal( json, timing )
}

/** Performs retroratcheting function by adding new knots to leave
 "days" number of days to derailment based on today data point
 (which may be flatlined).
 @param {Number} days Number of buffer days to preserve*/
this.retroRatchet = ( days ) => {
  if (!opts.roadEditor) return
  setSafeDays( days )
}

/** Schedules a break starting from a desired point beyond the
 * akrasia horizon and extending for a desired number of days.
 @param {String} start Day to start the break, formatted as YYYY-MM-DD
 @param {Number} days Number of days fof the break
 @param {Boolean} insert Whether to insert into or overwrite onto the current road
*/
this.scheduleBreak = ( start, days, insert ) => {
  if (!opts.roadEditor) return
  if (isNaN(days)) return
  if (road.length == 0) {
    console.log("bgraph("+curid+"):scheduleBreak(), road is empty!")
    return
  }
  var begintime = bu.dayparse(start, '-')
  // Find or add a new dot at the start of break
  // We only allow the first step to record undo info.
  var firstseg = -1, i, j
  for (i = 1; i < road.length; i++) {
    if (road[i].sta[0] === begintime) {
      firstseg = i; break
    }
  }
  var added = false;
  if (firstseg < 0) {addNewDot(begintime);added = true;}
  if (!added) pushUndoState()
  for (i = 1; i < road.length; i++) {
    if (road[i].sta[0] === begintime) {
      firstseg = i; break
    }
  }
  if (insert) {
    // First, shift all remaining knots right by the requested
    // number of days
    road[firstseg].end[0] = bu.daysnap(road[firstseg].end[0]+days*SID)
    for (j = firstseg+1; j < road.length; j++) {
      road[j].sta[0] = bu.daysnap(road[j].sta[0]+days*SID)
      road[j].end[0] = bu.daysnap(road[j].end[0]+days*SID)
    }
    // Now, create and add the end segment if the value of the
    // subsequent endpoint was different
    if (road[firstseg].sta[1] != road[firstseg].end[1]) {
      var segment = {}
      segment.sta = road[firstseg].sta.slice()
      segment.sta[0] = bu.daysnap(segment.sta[0]+days*SID)
      segment.end = road[firstseg].end.slice()
      segment.slope = br.segSlope(segment)
      segment.auto = br.RP.VALUE
      road.splice(firstseg+1, 0, segment)
      road[firstseg].end = segment.sta.slice()
      road[firstseg].slope = 0
      br.fixRoadArray( road, br.RP.VALUE, false)
    }
  } else {
    // Find the right boundary for the segment for overwriting
    var endtime = bu.daysnap(road[firstseg].sta[0]+days*SID)
    var lastseg = br.findSeg( road, endtime )
    if (road[lastseg].sta[0] != endtime) {
      // If there are no dots on the endpoint, add a new one
      addNewDot(endtime); 
      if (added) {undoBuffer.pop(); added = true}
      lastseg = br.findSeg( road, endtime )
    }
    // Delete segments in between
    for (j = firstseg+1; j < lastseg; j++) {
      road.splice(firstseg+1, 1)
    }
    road[firstseg].end = road[firstseg+1].sta.slice()
    var valdiff = road[firstseg+1].sta[1] - road[firstseg].sta[1]
    for (j = firstseg; j < road.length; j++) {
      road[j].end[1] -= valdiff
      road[j].slope = br.segSlope(road[j])
      if (j+1 < road.length) road[j+1].sta[1] = road[j].end[1]
    }
    br.fixRoadArray( road, br.RP.SLOPE, false)
  }
  roadChanged()
}

/** Dials the road to the supplied slope starting from the akrasia horizon
 @param {Number} newSlope New road slope to start in a week
*/
this.commitTo = ( newSlope ) => {
  if (!opts.roadEditor) return
  if (isNaN(newSlope)) return
  if (road.length == 0) {
    console.log("bgraph("+curid+"):commitTo(), road is empty!")
    return
  }
  if (road[road.length-2].slope == newSlope) return

  // Find out if there are any segments beyond the horizon
  var horseg = br.findSeg(road, gol.horizon)
  if (road[horseg].sta[0] == gol.horizon || horseg < road.length-2) {
    // There are knots beyond the horizon. Only adjust the last segment
    pushUndoState()
  } else {
    addNewDot(gol.horizon)
  }
  road[road.length-2].slope = newSlope
  br.fixRoadArray( road, br.RP.VALUE, false )
  roadChanged()
}

/** Returns an object with an array ('road') containing the current roadmatix
 (latest edited version), as well as the following members:<br/>
 <ul>
 <li><b>valid</b>: whether edited road intersects the pink region or not</li>
 <li><b>loser</b>: whether edited road results in a derailed goal or not</li>
 <li><b>asof</b>: unix timestamp for "now"</li>
 <li><b>horizon</b>: unix timestamp for the current akrasia horizon</li>
 <li><b>siru</b>: seconds in rate units</li>
 </ul>
*/
this.getRoad = () => {
  function dt(d) { return moment.unix(d).utc().format("YYYYMMDD")}
  // Format the current graph matrix to be submitted to Beeminder
  var r = {}, seg, rd, kd
  if (road.length == 0) {
    console.log("bgraph("+curid+"):getRoad(), road is empty!")
    return null
  }
  r.valid = isRoadValid(road)
  r.loser = br.redyest(road, gol, gol.tcur) // TODO: needs iso here
  r.asof = gol.asof
  r.horizon = gol.horizon
  r.siru = gol.siru
  //r.tini = dt(road[0].end[0])
  //r.vini = road[0].end[1]
  r.road = []
  for (let i = 0; i < road.length-1; i++) {
    seg = road[i]
    if (seg.sta[0] == seg.end[0] && seg.sta[1] == seg.end[1])
      continue
    kd = moment.unix(seg.end[0]).utc()
    rd = [kd.format("YYYYMMDD"), seg.end[1], seg.slope*gol.siru]
    if (seg.auto == br.RP.DATE) rd[2] = null // Exception here since roadall does not support null dates
    if (seg.auto == br.RP.VALUE) rd[1] = null
    if (seg.auto == br.RP.SLOPE) rd[2] = null
    //if (i == road.length-2) {
    //    r.tfin = rd[0]
    //    r.vfin = rd[1]
    //    r.rfin = rd[2]
    //} else 
    r.road.push(rd)
  }
  return r
}

/** Generates a data URI downloadable from the link element
 supplied as an argument. If the argument is empty or null,
 replaces page contents with a cleaned up graph suitable to be
 used with headless chrome --dump-dom to retrieve the contents as
 a simple SVG.
@param {object} [linkelt=null] Element to provide a link for the SVG object to download. If null, current page contents are replaced. */
this.saveGraph = ( linkelt = null ) => {
  // retrieve svg source as a string
  const svge = svg.node()
  const serializer = new XMLSerializer()
  let source = serializer.serializeToString(svge)

  //set url value to a element's href attribute.
  if (opts.headless || linkelt == null) {
    // If no link is provided or we are running in headless mode ,
    // replace page contents with the svg and eliminate
    // unnecessary elements
    document.head.remove()
    document.body.innerHTML = source

    // Eliminate unnecessary components from the SVG file in headless mode
    if (opts.headless) {
      var newroot = d3.select(document.body)
      //newroot.selectAll(".zoomarea").remove();
      newroot.selectAll(".buttonarea").remove()
      newroot.selectAll(".brush").remove()
      newroot.selectAll(".zoomin").remove()
      newroot.selectAll(".zoomout").remove()
      //newroot.selectAll(".minor").remove()
    }
  } else {
    // Remove styling once serialization is completed
    //defs.select('style').remove()

    // add name spaces
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source= source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    }
    if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, 
                              '<svg xmlns:xlink="http://www.w3.org/1999/xlink"')
    }

    //add xml declaration
    source = '<?xml version="1.0" standalone="no"?>\n' + source

    //convert svg source to URI data scheme.
    var url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source)

    //set url value to a element's href attribute.
    linkelt.href = url
  }
}

/** Informs the module instance that the element containing the
 visuals will be hidden. Internally, this prevents calls to
 getBBox(), eliminating associated exceptions and errors. 
 @see {@link bgraph#show}*/
this.hide = () => {hidden = true}

/** Informs the module instance that the element containing the
 visuals will be shown again. This forces an update of all visual
 elements, which might have previously been incorrectly rendered
 if hidden. 
 @see {@link bgraph#hide}*/
this.show = () => {
  //console.debug("curid="+curid+", show()");
  hidden = false
  if (road.length == 0) {
    console.log("bgraph("+curid+"):show(), road is empty!")
    return
  }
  redrawXTicks()
  adjustYScale()
  handleYAxisWidth()
  resizeBrush()
  updateTable()
  updateContextData()
  updateGraphData(true)
}

this.loading = (flag) => {
  if (flag) showOverlay(['loading...'], sh/10)
  else removeOverlay()
}
/** Returns the graph matrix object (in the internal format) for the
    goal. Primarily used to synchronize two separate graph
    instances on the same HTML page. 
    @return {object} Internal road object
    @see bgraph#setRoadObj
*/
this.getRoadObj = () => br.copyRoad(road)

this.getGoalObj = () => (gol)

/** Flag to indicate whether we are within a call to
 * setRoadObj(). Prevents repeated calls to beebrain.reloadRoad()
 * since beebrain.setRoadObj() already calls reloadRoad()*/
var settingRoad = false

/** Sets the graph matrix (in the internal format) for the
    goal. Primarily used to synchronize two separate graph
    instances on the same HTML page. Should only be called with
    the return value of {@link bgraph#getRoadObj}.
    @param {object} newroad Road object returned by {@link bgraph#getRoadObj}
    @param {Boolean} [resetinitial=false] Whether to set the internal "initial road" as well
    @see bgraph#getRoadObj
*/
this.setRoadObj = ( newroad, resetinitial = false ) => {
  if (settingRoad) return
  if (newroad.length == 0) {
    // TODO: More extensive sanity checking
    console.log("bgraph("+curid+"):setRoadObj(), new road is empty!")
    return
  }
  settingRoad = true
  // Create a fresh copy to be safe
  pushUndoState()

  road = br.copyRoad(newroad)
  if (resetinitial) {
    // Warning: If the initial road is reset, tini might not be
    // updated since its update in roadChanged() relies on the
    // previous tini and the first road element being the same
    iroad = br.copyRoad(newroad)
    clearUndoBuffer()
  }
  bbr.setRoadObj(newroad)
  roadChanged()
  settingRoad = false
}

/** Checks whether the goal is currently in a derailed state
    @returns {Boolean} 
*/
this.isLoser = () => {
  if (gol && road.length != 0)
    return br.redyest(road, gol, gol.tcur) // TODO: needs iso here
  else return false
}

this.getProgress = () => {
  return [[bu.dayify(gol.tini,'-'), gol.vini], [bu.dayify(gol.tcur,'-'), gol.vcur], [bu.dayify(gol.tfin,'-'), gol.vfin]]
}
  
/** Returns current goal state
    @returns {object} Current goal state as [t, v, r, rdf(t)] or null if no goal
*/
this.curState =
  () => (gol ? [gol.tcur, gol.vcur, gol.rcur, br.rdf(road, gol.tcur)] : null)

/** @typedef GoalVisuals
    @global
    @type {object}
    @property {Boolean} plotall Plot all points instead of just the aggregated point
    @property {Boolean} steppy Join dots with purple steppy-style line
    @property {Boolean} rosy Show the rose-colored dots and connecting line
    @property {Boolean} movingav Show moving average line superimposed on the data
    @property {Boolean} aura Show blue-green/turquoise aura/swath
    @property {Boolean} hidey Whether to hide the y-axis numbers
    @property {Boolean} stathead Whether to include label with stats at top of graph
    @property {Boolean} hashtags Show annotations on graph for hashtags in comments 
*/
const visualProps
      = ['plotall','steppy','rosy','movingav','aura','hidey','stathead','hashtags']
/** Returns visual properties for the currently loaded goal
    @returns {GoalVisuals} 
    @see {@link bgraph#getGoalConfig}
*/
this.getVisualConfig = ( ) =>{
  var out = {}
  visualProps.map(e=>{ out[e] = gol[e] })
  return out
}

/** Returns a flag indicating whether external image references on
 * the svg have finished loading or not */
this.xlinkLoaded = () => true

/** @typedef GoalProperties
    @global
    @type {object}
    @property {Boolean} yaw Which side of the YBR you want to be on, +1 or -1
    @property {Boolean} dir Which direction you'll go (usually same as yaw)
    @property {Boolean} kyoom Cumulative; plot vals as sum of those entered so far
    @property {Boolean} odom Treat zeros as accidental odom resets
    @property {Boolean} monotone Whether data is necessarily monotone
    @property {String} aggday Aggregation function for the day's official value
*/
const goalProps
      = ['yaw','dir','kyoom','odom','monotone','aggday']
/** Returns properties for the currently loaded goal
    @returns {GoalProperties} 
    @see {@link bgraph#getVisualConfig}
 */
this.getGoalConfig = ( ) => {
  let out = {}
  goalProps.map(e => { out[e] = gol[e] })
  return out
}

/** Display supplied message overlaid towards the top of the graph
    @param {String} msg What to display. Use null to remove existing message. */
this.msg = (msg)=>{
  if (!msg) removeOverlay("message")
  else
    showOverlay([msg], 20, null, {x:sw/20, y:10, w:sw*18/20, h:50},
                "message", false, true, svg)
}

/** Animates the Akrasia horizon element in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animHor = animHor
/** Animates the Yellow Brick Road elements in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animYBR = animYBR
/** Animates datapoints in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animData = animData
/** Animates guideline elements in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animGuides = animGuides
/** Animates the rosy line in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animRosy = animRosy
/** Animates the moving average in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animMav = animMav
/** Animates YBHP lines at 1, 2 and 6 days
    @method
    @param {Boolean} enable Enables/disables animation */
this.animYBHPlines = animYBHPlines
/** Animates the aura element in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animAura = animAura
/** Animates the waterbuf element in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animBuf = animBuf
/** Animates the waterbux element in the graph
    @method
    @param {Boolean} enable Enables/disables animation */
this.animBux = animBux

} // END bgraph object constructor ---------------------------------------------

return bgraph

})) // END MAIN ----------------------------------------------------------------
