Object.prototype.isEmpty = function () {
  if (Object.keys(this).length === 0) {
    return true
  }
  return false
};

Object.prototype.copy = function () {
  if (!Object.keys(this).length) {
    return JSON.parse(JSON.stringify(this))
  }
  return this
};

String.prototype.isEmpty = function () {
  if (Object.values(this).every((value) => value === '')) {
    return true
  }
  return false
};

class Budget {
  constructor() {
    this.apiKey = '667e428a7777072d52159e071dda7b4f';
    this.apiToken =
      '178e458be5a2f65e41dd36fa8ebf669af0addc8fd18ac5d84266e02f6df29269';
    this.keyAndToken = 'key=' + apiKey + '&token=' + apiToken;
    this.apiRoot = 'https://api.trello.com/1/';
    this.lineBreak = '%0A';
    //* telegramApi
    this.telegramToken = '806168491:AAE5G1oPobTtfArA0vMOH88S9bqi1EfSrjs';
    this.telegramUrl = 'https://api.telegram.org/bot' + telegramToken + '/';
    this.telegramChatId = ['740775802', '491950657'];
    this.telegramLineBreak = '\n';
    //* board id
    this.boardIdFact0 = '5e33ed07a1f5503ead51b63a';
    this.boardIdFact = '5e05161dc3abef51fcf4e761';
    this.boardIdBudget = '5e205c1e08b1ce8bac5a28e6';
    this.boardIdBudget2 = '5e33ebf6e535dd19af746f72';
    this.boardIdBudget3 = '5e33ed63d17a353274f570ce';
    this.boardIdTarget = '5e3cec63b47787407b262e0b';
    //* список книг
    this.sourceSheetID = '12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ';
    this.targetSheetID = '1KDKD7VKQbgiRNhGanH0j7WUO__rLrky1xWVeBK90xbE';
    //* список листов
    this.accountingItemSheetName = 't_d_accounting_item';
    this.costСenterSheetName = 't_d_cost_center';
    this.financialCenterSheetName = 't_d_financial_center';
    this.parametrSheetName = 't_d_period';
    this.goalsSheetName = 't_d_goal';
    this.sourceSheetNameTrello = 't_f_trello';
    this.sourceSheetNameLog = 't_f_log';
    this.sourceSheetNameError = 't_f_error';
    this.targetSheetNameAccount = 'Учет';
    this.targetSheetNameTarget = 'Цели';
    //* реакции трелло
    this.sunglasses = {
      unified: '1F60E',
      native: '😎',
      shortName: 'sunglasses',
    };
    this.buuReaction = {
      unified: '1F60D',
      native: '😍',
      shortName: 'heart_eyes',
    };
    this.fetch = (url, data) => {
      return UrlFetchApp.fetch(url, data)
    };
    this.SpreadsheetApp = SpreadsheetApp;
  }

  updateAccountData() {
    try {
      const trelloOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.sourceSheetNameTrello
      );
      const accountOpen = openGoogleSheet(
        this.targetSheetID,
        this.targetSheetNameAccount
      );
      const currentDate = new Date();
      const startPeriodFact = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 2,
        1
      );
      const startPeriodBudget = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      );
      const endPeriod = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const trelloArray = this.getGoogleSheetValues(trelloOpen);
      const filterArray = trelloArray.reduce(function (row, array, index) {
        if (index != 0) {
          const object = {};
          //* данные из буфера трелло
          object.actionDate = array[0];
          object.period = array[1];
          object.cfo = array[2];
          object.mvz = array[3];
          object.cashFlow = array[4];
          object.bill = array[5];
          object.account = array[6];
          object.nomenclature = array[7];
          object.sum = array[8];
          object.comment = array[9];
          object.actionId = array[10];
          object.type = array[11];
          object.indexRow = index + 1;
          if (
            (this.isMatch(object.type, 'факт') &&
              new Date(object.period) >= startPeriodFact &&
              new Date(object.period) <= endPeriod) ||
            (this.isMatch(object.type, 'бюджет') &&
              new Date(object.period) >= startPeriodBudget &&
              new Date(object.period) <= endPeriod)
          ) {
            //* Преобразование объектов в массив
            const sheetRow = [
              object.actionDate,
              object.period,
              object.cfo,
              object.mvz,
              object.cashFlow,
              object.bill,
              object.account,
              object.nomenclature,
              object.sum,
              object.comment,
              object.actionId,
              object.type,
            ];
            row.push(sheetRow);
          }
        }
        return row
      }, []);
      if (accountOpen.getMaxRows() !== 1) {
        accountOpen.deleteRows(2, accountOpen.getMaxRows() - 1);
      }
      //* Опредление диапазона и вставка данных
      accountOpen
        .getRange(
          accountOpen.getLastRow() + 1,
          1,
          filterArray.length,
          filterArray[0].length
        )
        .setValues(filterArray);
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {*} postObject входные параметра запроса
   * @param {*} labelName входной параметр имени метки
   * @param {*} labelColor входной параметр цвета метки
   * @param {*} boardId входной параметр ID доски trello
   * @returns
   */
  addBoardLabel(postObject, labelName, labelColor, boardId) {
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        postObject.apiRoot +
          'labels?name=' +
          labelName +
          '&color=' +
          labelColor +
          '&idBoard=' +
          boardId +
          '&' +
          postObject.keyAndToken,
        data
      );
      var variable = {};
      variable.id = JSON.parse(resp).id;
      variable.name = JSON.parse(resp).name;
      return variable
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {string} boardId входной параметр ID листа trello
   * @returns {[]}
   */
  getBoardLabel(boardId) {
    try {
      var data = {
        method: 'get',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          'boards/' +
          boardId +
          '/labels?fields=all&limit=10&' +
          this.keyAndToken,
        data
      );
      var respData = JSON.parse(resp);
      var respArray = [];
      respData.reduce(function (variable, array) {
        variable = {};
        variable.id = array.id;
        variable.name = array.name;
        variable.color = array.color;
        return respArray.push(variable)
      }, {});
      return respArray
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {string} boardId входной параметр ID доски trello
   * @param {string} boardName входной параметр наименования доски trello
   */
  updateBoard(boardId, boardName) {
    try {
      var data = {
        method: 'put',
        contentType: 'application/json',
      };
      this.fetch(
        this.apiRoot +
          'boards/' +
          boardId +
          '?name=' +
          boardName +
          '&' +
          this.keyAndToken,
        data
      );
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {string} cardName входной параметр наименования карточки trello
   * @param {string} listId входной параметр ID листа trello
   * @param {number} pos позиция карточки на листе
   * @param {string} labelId входной параметр ID метки trello
   * @returns
   */
  addCard(cardName, listId, pos, labelId) {
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      var resp;
      var position;
      pos == undefined ? (position = 'bottom') : (position = pos);
      if (labelId == undefined) {
        resp = this.fetch(
          this.apiRoot +
            '/cards?pos=' +
            position +
            '&name=' +
            cardName +
            '&idList=' +
            listId +
            '&' +
            this.keyAndToken,
          data
        );
      } else {
        resp = this.fetch(
          this.apiRoot +
            '/cards?pos=' +
            position +
            '&name=' +
            cardName +
            '&idList=' +
            listId +
            '&idLabels=' +
            labelId +
            '&' +
            this.keyAndToken,
          data
        );
      }
      var variable = {};
      variable.id = JSON.parse(resp).id;
      variable.name = JSON.parse(resp).name;
      return variable
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @param {string} cardId
   * @param {string} cardComment
   */
  addCardComment(cardId, cardComment) {
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      this.fetch(
        this.apiRoot +
          'cards/' +
          cardId +
          '/actions/comments?text=' +
          cardComment +
          '&' +
          this.keyAndToken,
        data
      );
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  addCardReaction() {
    try {
      const reactions = [];
      if (isMatch(this.memberId, '55cb5c5729ae976dfd2b901e')) {
        reactions.push(this.buuReaction);
      } else {
        reactions.push(this.sunglasses);
      }
      reactions.forEach(function (reaction) {
        var payload = JSON.stringify(reaction);
        var data = {
          method: 'post',
          contentType: 'application/json',
          payload: payload,
        };
        this.fetch(
          this.apiRoot +
            'actions/' +
            this.actionId +
            '/reactions?' +
            this.keyAndToken,
          data
        );
      });
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {*} postObject входные параметра запроса
   */
  archiveAllCards(listId) {
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      this.UrlFetchAppUrlFetchApp.fetch(
        this.apiRoot +
          'lists/' +
          listId +
          '/archiveAllCards?' +
          this.keyAndToken,
        data
      );
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {*} postObject входные параметра запроса
   * @param {*} cardId входной параметр ID карточки trello
   */
  closeCard(postObject, cardId) {
    try {
      var data = {
        method: 'put',
        contentType: 'application/json',
      };
      this.UrlFetchAppUrlFetchApp.fetch(
        this.apiRoot + '/cards/' + cardId + '?closed=true&' + this.keyAndToken,
        data
      );
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {*} postObject входные параметра запроса
   * @param {*} listId  входной параметр ID листа trello
   * @param {*} idCardSource входной параметр ID карточки - исходника trello
   * @returns
   */
  copyCard(postObject, listId, idCardSource) {
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          '/cards?pos=bottom&idList=' +
          listId +
          '&idCardSource=' +
          idCardSource +
          '&keepFromSource=attachments,checklists,due,members,stickers&' +
          this.keyAndToken,
        data
      );
      var variable = {};
      variable.id = JSON.parse(resp).id;
      variable.name = JSON.parse(resp).name;
      return variable
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getCardLabel(postObject) {
    try {
      var data = {
        method: 'get',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          'cards/' +
          postObject.cardId +
          '/labels?' +
          this.keyAndToken,
        data
      );
      var respData = JSON.parse(resp);
      var variable = {};
      variable.item = {};
      variable.array = [];
      respData.reduce(function (row, array, index) {
        if (index == 0) {
          row = {};
          row.id = array.id;
          row.name = array.name;
          row.color = array.color;
          variable.item = row;
          variable.array.push(row);
        } else {
          row = {};
          row.id = array.id;
          row.name = array.name;
          row.color = array.color;
          variable.array.push(row);
        }
      }, {});
      return variable
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getCardList(postObject) {
    try {
      var data = {
        method: 'get',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          'cards/' +
          postObject.cardId +
          '/list?&' +
          this.keyAndToken,
        data
      );
      var respData = JSON.parse(resp);
      var variable = {};
      variable.id = respData.id;
      variable.name = respData.name;
      return variable
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @param {string} listId
   * @param {string} nomenclatureName
   */
  getCards(listId, nomenclatureName) {
    try {
      var data = {
        method: 'get',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot + 'lists/' + listId + '/cards?' + this.keyAndToken,
        data
      );
      var respData = JSON.parse(resp);
      var cards = {};
      cards.item = {};
      cards.array = [];
      respData.reduce(function (variable, array) {
        if (array.name == nomenclatureName) {
          variable = {};
          variable.id = array.id;
          variable.name = array.name;
          cards.item = variable;
          cards.array.push(variable);
        } else {
          variable = {};
          variable.id = array.id;
          variable.name = array.name;
          cards.array.push(variable);
        }
      }, []);
      return cards
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  moveAllCards(listIdOld, listIdNew, boardIdNew) {
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      this.fetch(
        this.apiRoot +
          'lists/' +
          listIdOld +
          '/moveAllCards?idBoard=' +
          listIdNew +
          '&idList=' +
          boardIdNew +
          '&' +
          this.keyAndToken,
        data
      );
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  moveCard(postObject) {
    try {
      var data = {
        method: 'put',
        contentType: 'application/json',
      };
      this.fetch(
        this.apiRoot +
          'cards/' +
          postObject.cardId +
          '/idBoard?value=' +
          postObject.boardId +
          '&idList=' +
          postObject.listId +
          '&' +
          this.keyAndToken,
        data
      );
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  updateCardDesc(postObject) {
    try {
      var data = {
        method: 'put',
        contentType: 'application/json',
      };
      this.fetch(
        this.apiRoot +
          'cards/' +
          postObject.cardId +
          '?desc=' +
          postObject.cardDescription +
          '&' +
          this.keyAndToken,
        data
      );
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  addCheckList(postObject, cardId, checkListName) {
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          'cards/' +
          cardId +
          '/checklists?name=' +
          checkListName +
          '&' +
          this.keyAndToken,
        data
      );
      var variable = {};
      variable.id = JSON.parse(resp).id;
      variable.name = JSON.parse(resp).name;
      return variable
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  addCheckListItem(postObject, checkListId, nameItem) {
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          'checklists/' +
          checkListId +
          '/checkItems?name=' +
          nameItem +
          '&pos=bottom&checked=false&' +
          this.keyAndToken,
        data
      );
      var variable = {};
      variable.id = JSON.parse(resp).id;
      variable.name = JSON.parse(resp).name;
      return variable
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getCheckList(postObject, cardId) {
    try {
      var data = {
        method: 'get',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          'cards/' +
          cardId +
          '/checklists?checkItems=all&checkItem_fields=all&filter=all&fields=all&' +
          this.keyAndToken,
        data
      );
      var respData = JSON.parse(resp);
      var variable = respData.reduce(function (row, array) {
        if (array.name.match('Бюджет')) {
          row = {};
          row.id = array.id;
          row.name = array.id;
          row.checkItems = array.checkItems;
        }
        return row
      });
      return variable
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * Преобразование времени из чиста в стороку
   * @param {number} t - число
   */
  timeToStr(t) {
    try {
      var ms = t % 1000;
      t -= ms;
      ms = Math.floor(ms / 10);
      t = Math.floor(t / 1000);
      var s = t % 60;
      t -= s;
      t = Math.floor(t / 60);
      var m = t % 60;
      t -= m;
      t = Math.floor(t / 60);
      var h = t % 60;
      if (h < 10) h = '0' + h;
      if (m < 10) m = '0' + m;
      if (s < 10) s = '0' + s;
      if (ms < 10) ms = '0' + ms;
      return h + ':' + m + ':' + s + '.' + ms
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * Преобразование времени из чиста в стороку
   * @param {date} start - дата начала
   */
  findTime(start) {
    try {
      const thisDate = new Date();
      const tdiff = thisDate.valueOf() - start.valueOf();
      return timeToStr(tdiff)
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  addErrorItem(error) {
    try {
      const errorOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.sourceSheetNameError
      );
      errorOpen.appendRow([formatterDate().timestamp, '', '', error]);
    } catch (e) {
      console.error(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @param {date} dt
   */
  formatterDate(dt) {
    //* форматирование даты
    try {
      if (dt == undefined) {
        dt = new Date();
      }
      const formatter = {};
      formatter.date = Utilities.formatDate(new Date(dt), 'GMT+3', 'dd.MM.yyyy');
      formatter.time = Utilities.formatDate(
        new Date(dt),
        'GMT+3',
        'dd.MM.yyyy HH:mm'
      );
      formatter.timestamp = Utilities.formatDate(
        new Date(dt),
        'GMT+3',
        'dd.MM.yyyy HH:mm:ss'
      );
      return formatter
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  objectToString(data) {
    try {
      const object = JSON.stringify(data);
      return object
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  addLog(postData) {
    try {
      if (this.isValidateAction(postData) && this.isUser(postData)) {
        const sourceOpen = this.openGoogleSheet(
          this.sourceSheetID,
          this.sourceSheetNameLog
        );
        const startDate = this.getPreviousDate(180);
        const sourceArray = this.getGoogleSheetValues(sourceOpen).reduce(
          function (row, array, index) {
            if (index != 0) {
              if (array[0] >= startDate) {
                row.push(array);
              }
            }
            return row
          },
          []
        );
        const isNewAction = sourceArray.reduce(function (row, array) {
          if (isMatch(postData.action.id, array[2])) {
            row = false;
          }
          return row
        }, true);
        if (isNewAction) {
          sourceOpen.appendRow([
            formatterDate().timestamp,
            postData.action.type,
            postData.action.id,
          ]);
        }
        return isNewAction
      } else {
        return false
      }
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @param {string} sheetID
   * @param {sheetName} sheetID
   */
  openGoogleSheet(sheetID, sheetName) {
    try {
      const object = this.SpreadsheetApp.openById(sheetID).getSheetByName(
        sheetName
      );
      return object
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @param {Object} openSheet
   * @returns
   */
  getGoogleSheetValues(openSheet) {
    try {
      const object = openSheet.getDataRange().getValues();
      return object
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  isValidDate(d) {
    try {
      if (Object.prototype.toString.call(d) !== '[object Date]') {
        return false
      } else {
        return !isNaN(d.getTime())
      }
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  isValidString(d) {
    try {
      if (Object.prototype.toString.call(d) == '[object String]') {
        return true
      } else {
        return false
      }
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  isMatch(where, what) {
    try {
      if (this.isValidString(where) && this.isValidString(what)) {
        if (
          where
            .toLowerCase()
            .replace(/\s+/g, '')
            .trim()
            .match(what.toLowerCase().replace(/\s+/g, '').trim())
        ) {
          return true
        } else {
          return false
        }
      } else {
        return false
      }
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {da} dt
   * @returns
   */
  getYMD(dt) {
    try {
      if (!this.isValidDate(dt)) {
        var date = new Date(dt);
      }
      const object = {};
      object.y = new Date(date).getFullYear();
      object.m = new Date(date).getMonth() + 1;
      object.d = new Date(date).getDate();
      object.ymd =
        object.y.toString() + object.m.toString() + object.d.toString();
      return object
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @returns {object}
   */
  copyObject() {
    try {
      const newThis = Object.fromEntries(
        Object.entries(this).map((m) => (m = m))
      );
      return newThis
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {number} dayCount количество дней
   * @returns
   */
  getPreviousDate(dayCount) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - dayCount);
      return startDate
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  encodeData(data, symbol) {
    try {
      const encodeSymbol = encodeURIComponent(symbol);
      const encodeData = encodeURIComponent(data);
      if (this.isMatch(encodeData, encodeSymbol)) {
        return data.replace(symbol, encodeURIComponent(symbol))
      } else {
        return data
      }
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  deleteLog() {
    try {
      const sourceOpen = this.logOpen;
      const startDate = this.getPreviousDate(90);
      const deleteArrya = [];
      this.getGoogleSheetValues(sourceOpen).reduce(function (
        row,
        array,
        index
      ) {
        if (index > 0) {
          if (array[0] <= startDate) {
            deleteArrya.push(index + 1);
          }
        }
        return row
      },
      []);
      if (deleteArrya.length > 0) {
        const startDeleteIndex = deleteArrya.reduce(function (a, b) {
          return a < b ? a : b
        });
        const countDeleteRow = deleteArrya.reduce(function (a, b) {
          return a > b ? a : b
        });
        sourceOpen.deleteRows(startDeleteIndex, countDeleteRow);
      }
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  deleteError() {
    try {
      const errorOpen = this.errorOpen;
      const startDate = this.getPreviousDate(1);
      const deleteArrya = [];
      this.errorArray.reduce(function (row, array, index) {
        if (index != 0) {
          if (array[0] <= startDate) {
            deleteArrya.push(index + 1);
          }
        }
        return row
      }, []);
      if (deleteArrya.length > 0) {
        const startDeleteIndex = deleteArrya.reduce(function (a, b) {
          return a < b ? a : b
        });
        const countDeleteRow = deleteArrya.reduce(function (a, b) {
          return a > b ? a : b
        });
        errorOpen.deleteRows(startDeleteIndex, countDeleteRow);
      }
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getPostObject(postData) {
    try {
      this.webHookDate = formatterDate().timestamp;
      this.actionType = postData.action.type;
      this.webHookActionId = postData.action.id;
      //* открытие листов
      this.financialCenterSheetOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.financialCenterSheetName
      );
      this.accountingItemSheetOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.accountingItemSheetName
      );
      this.costСenterSheetOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.costСenterSheetName
      );
      this.parametrSheetOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.parametrSheetName
      );
      this.goalsSheetOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.goalsSheetName
      );
      this.trelloOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.sourceSheetNameTrello
      );
      this.errorOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.sourceSheetNameError
      );
      this.logOpen = this.openGoogleSheet(
        this.sourceSheetID,
        this.sourceSheetNameLog
      );
      this.targetOpen = this.openGoogleSheet(
        this.targetSheetID,
        this.targetSheetNameTarget
      );
      //* данные с листов
      this.financialСenterArray = this.getGoogleSheetValues(
        this.financialCenterSheetOpen
      );
      this.accountingItemArray = this.getGoogleSheetValues(
        this.accountingItemSheetOpen
      );
      this.costСenterArray = this.getGoogleSheetValues(this.costСenterSheetOpen);
      this.parametrArray = this.getGoogleSheetValues(this.parametrSheetOpen);
      this.goalsArray = this.getGoogleSheetValues(this.goalsSheetOpen);
      this.trelloArray = this.getGoogleSheetValues(this.trelloOpen);
      this.errorArray = this.getGoogleSheetValues(this.errorOpen);
      this.targetArray = this.getGoogleSheetValues(this.targetOpen);
      if (
        ['updateComment', 'deleteComment'].indexOf(postData.action.type) !== -1
      ) {
        this.actionId = postData.action.data.action.id;
      } else {
        this.actionId = postData.action.id;
      }
      this.actionDate = new Date(postData.action.date);
      this.memberId = postData.action.memberCreator.id;
      this.memberUsername = postData.action.memberCreator.username;
      this.boardId = postData.action.data.board.id;
      this.boardName = postData.action.data.board.name;
      if ([this.boardIdFact, this.boardIdFact0].indexOf(this.boardId) !== -1) {
        this.isFact = true;
        if ([this.boardIdFact].indexOf(this.boardId) !== -1) {
          this.isCurrFact = true;
        } else {
          this.isCurrFact = false;
        }
        this.isBudget = false;
        this.isCurrBudget = false;
        this.isTarget = false;
        this.type = 'Факт';
      } else if (
        [this.boardIdBudget, this.boardIdBudget2, this.boardIdBudget3].indexOf(
          this.boardId
        ) !== -1
      ) {
        this.isFact = false;
        this.isCurrFact = false;
        this.isBudget = true;
        if ([this.boardIdBudget].indexOf(this.boardId) !== -1) {
          this.isCurrBudget = true;
        } else {
          this.isCurrBudget = false;
        }
        this.isTarget = false;
        this.type = 'Бюджет';
      } else if ([this.boardIdTarget].indexOf(this.boardId) !== -1) {
        this.isFact = false;
        this.isCurrFact = false;
        this.isBudget = false;
        this.isCurrBudget = false;
        this.isTarget = true;
        this.type = 'Факт';
      }
      if (
        ['deleteComment', 'updateComment', 'commentCard', 'updateCard'].indexOf(
          postData.action.type
        ) !== -1
      ) {
        this.cardId = postData.action.data.card.id;
        this.cardName = postData.action.data.card.name;
        this.cardDescription = '';
        this.cardComment = '';
        this.cardLabelColor = this.getCardLabel(this).item.color;
      }
      if (
        ['commentCard', 'createList', 'updateCard', 'updateList'].indexOf(
          postData.action.type
        ) !== -1
      ) {
        this.listId = postData.action.data.list.id;
        this.listName = postData.action.data.list.name;
        if (['updateList'].indexOf(postData.action.type) !== -1) {
          this.listClosed = postData.action.data.list.closed;
        }
        if (['updateCard'].indexOf(postData.action.type) !== -1) {
          this.cardClosed = postData.action.data.card.closed;
        }
      } else if (
        ['updateComment', 'deleteComment'].indexOf(postData.action.type) !== -1
      ) {
        this.list = this.getCardList(this);
        this.listId = object.list.id;
        this.listName = object.list.name;
      }
      if (this.isTarget) {
        this.cfo = this.getTarget(this).item.cfo;
      } else {
        this.cfo = this.getFinancialСenter().item.cfo;
      }
      if (['Илья', 'Оксана'].indexOf(this.cfo) !== -1) {
        this.privateBudget = true;
      } else {
        this.privateBudget = false;
      }
      if (
        ['deleteComment', 'updateComment', 'commentCard', 'updateCard'].indexOf(
          postData.action.type
        ) !== -1
      ) {
        this.accountingItem = this.getAccountingItem(this);
        this.cashFlow = object.accountingItem.item.cashFlow;
        this.bill = object.accountingItem.item.bill;
        this.account = object.accountingItem.item.account;
        this.nomenclature = postData.action.data.card.name;
        if (
          ['updateComment', 'commentCard'].indexOf(postData.action.type) !== -1
        ) {
          if (['updateComment'].indexOf(postData.action.type) !== -1) {
            this.text = postData.action.data.action.text;
          } else {
            this.text = postData.action.data.text;
          }
          this.parseText = this.parseComment(this);
          this.sum = object.parseText.sum;
          if (['updateComment'].indexOf(postData.action.type) !== -1) {
            const objectOld = this.copyObject();
            objectOld.text = postData.action.data.old.text;
            this.oldSum = this.parseComment(objectOld).sum;
          }
          this.comment = this.parseText.comment;
          if (this.isTarget) {
            this.mvz = this.getTarget(this).item.goal;
          } else {
            this.mvz = getCostСenter(this).item.mvz;
          }
        }
      }
      if (['createList', 'updateList'].indexOf(postData.action.type) !== -1) {
        const currDate = new Date();
        this.period = new Date(currDate.getFullYear(), currDate.getMonth(), 1);
        this.ymd = this.getYMD(this.period);
        this.factPeriod2 = new Date(
          this.period.getFullYear(),
          this.period.getMonth() - 2,
          1
        );
        this.factPeriod1 = new Date(
          this.period.getFullYear(),
          this.period.getMonth() - 1,
          1
        );
        this.factPeriod = this.period;
        this.budgetPeriodCurrent = this.period;
        this.budgetPeriod = new Date(
          this.period.getFullYear(),
          this.period.getMonth() + 1,
          1
        );
        this.budgetPeriod2 = new Date(
          this.period.getFullYear(),
          this.period.getMonth() + 2,
          1
        );
        this.budgetPeriod3 = new Date(
          this.period.getFullYear(),
          this.period.getMonth() + 3,
          1
        );
      } else {
        this.date = this.getPeriod(this);
        this.period = this.date.period;
        this.ymd = this.date.ymd;
        this.factPeriod2 = this.date.factPeriod2;
        this.factPeriod1 = this.date.factPeriod1;
        this.factPeriod = this.date.factPeriod;
        this.budgetPeriodCurrent = this.date.budgetPeriodCurrent;
        this.budgetPeriod = this.date.budgetPeriod;
        this.budgetPeriod2 = this.date.budgetPeriod2;
        this.budgetPeriod3 = this.date.budgetPeriod3;
      }
      if (
        ['deleteComment', 'updateComment', 'commentCard'].indexOf(
          postData.action.type
        ) !== -1
      ) {
        this.dataTrello = this.getAllDataTrello(
          this.factPeriod.this.budgetPeriod
        );
      }
      if (
        ['deleteComment', 'updateComment'].indexOf(postData.action.type) !== -1
      ) {
        this.isOldData = this.isOldData(this);
      } else {
        this.isOldData = false;
      }
      return this
    } catch (e) {
      addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  addFinancialCenter(postObject) {
    /*
     * @postObject - входные параметра запроса
     * */
    try {
      var ss = postObject.financialCenterSheetOpen;
      var ssParametr = postObject.parametrSheetOpen;
      var array = this.getFinancialСenter().array;
      var arrayPаrametr = this.getParametr(postObject).array;
      var cfoArray = array.map(function (array) {
        return array.id
      });
      var parametrArray = arrayPаrametr.map(function (array) {
        return array.id
      });
      if (postObject.cfo == undefined) {
        var newId = cfoArray.length + 1;
        ss.appendRow([
          newId,
          postObject.listName,
          this.formatterDate().timestamp,
        ]);
        postObject.financialСenterArray = this.getGoogleSheetValues(
          postObject.financialCenterSheetOpen
        );
        var newIdParametr = parametrArray.length + 1;
        ssParametr.appendRow([
          newIdParametr,
          'Факт',
          postObject.listName,
          postObject.factPeriod,
          formatterDate().timestamp,
        ]);
        ssParametr.appendRow([
          newIdParametr + 1,
          'Бюджет',
          postObject.listName,
          postObject.budgetPeriod,
          formatterDate().timestamp,
        ]);
      }
      //* обновление листа
      postObject.listName =
        postObject.listName + ' ' + formatterDate(postObject.period).date;
      this.updateList(postObject);
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  addTarget(postObject) {
    try {
      const ss = postObject.goalsSheetOpen;
      const array = this.getTarget().array;
      const goal = this.getTarget().item.goal;
      const cfo = this.getFinancialСenter().item.cfo;
      const objGoal = postObject.listName
        .toLowerCase()
        .replace(cfo.toLowerCase(), '')
        .trim();
      const newGoal = objGoal[0].toUpperCase() + objGoal.slice(1);
      const goalArray = array.map(function (array) {
        return array.name
      });
      const ssMvz = postObject.costСenterSheetOpen;
      const postObjectCopy = this.copyObject(postObject);
      postObjectCopy.comment = objGoal;
      postObjectCopy.cfo = cfo;
      const arrayMvz = this.getCostСenter(postObjectCopy).array;
      const tagMvz = objGoal.toLowerCase().replace(/\s+/g, '').trim();
      const newIdMvz = arrayMvz.length + 1;
      if (goal == undefined) {
        const newId = goalArray.length + 1;
        ss.appendRow([
          newId,
          postObject.listName,
          newGoal,
          cfo,
          formatterDate().timestamp,
          postObject.listId,
          'actual',
        ]);
        ssMvz.appendRow([newIdMvz, objGoal, tagMvz]);
        postObject.goalsArray = this.getGoogleSheetValues(
          postObject.goalsSheetOpen
        );
      }
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  closedBudgetPeriod() {
    try {
      const postObjectBudget = this.copyObject();
      postObjectBudget.boardId = postObjectBudget.boardIdBudget;
      postObjectBudget.listId = this.getList(postObjectBudget).id;
      postObjectBudget.listName =
        postObjectBudget.cfo +
        ' ' +
        this.formatterDate(postObjectBudget.budgetPeriod).date;
      this.archiveAllCards(postObjectBudget);
      this.updateList(postObjectBudget);
      const postObjectBudget2 = this.copyObject(postObjectBudget);
      postObjectBudget2.boardId = postObjectBudget2.boardIdBudget2;
      postObjectBudget2.listId = this.getList(postObjectBudget2).id;
      postObjectBudget2.listName =
        postObjectBudget2.cfo +
        ' ' +
        this.formatterDate(postObjectBudget2.budgetPeriod2).date;
      this.moveAllCards(postObjectBudget2, postObjectBudget);
      this.updateList(postObjectBudget2);
      const postObjectBudget3 = this.copyObject(postObjectBudget2);
      postObjectBudget3.boardId = postObjectBudget3.boardIdBudget3;
      postObjectBudget3.listId = this.getList(postObjectBudget3).id;
      postObjectBudget3.listName =
        postObjectBudget3.cfo +
        ' ' +
        this.formatterDate(postObjectBudget3.budgetPeriod3).date;
      this.moveAllCards(postObjectBudget3, postObjectBudget2);
      this.createCardsForList(postObjectBudget3);
      this.updateList(postObjectBudget3);
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  closedFactPeriod() {
    try {
      const postObjectFact0 = {};
      postObjectFact0.boardId = this.boardIdFact0;
      postObjectFact0.listId = this.getList().id;
      postObjectFact0.listName =
        postObjectFact0.cfo +
        ' ' +
        this.formatterDate(postObjectFact0.factPeriod1).date;
      if (postObjectFact0.listId == undefined) {
        postObjectFact0.listId = addList(
          postObjectFact0.listName,
          postObjectFact0.boardId
        ).id;
      } else {
        //* закрытие листа на доске факт-1
        this.archiveAllCards(postObjectFact0.listId);
        this.updateList(postObjectFact0.listId, postObjectFact0.listName);
      }
      //* Перенос карточек на доску факт-1
      this.moveAllCards(
        this.listId,
        postObjectFact0.listId,
        postObjectFact0.boardId
      );
      //* обновление текущего листа факта
      this.listName = this.cfo + ' ' + this.formatterDate(this.factPeriod).date;
      this.updateList(this.listId, this.listName);
      //* создание карточек на листе факт
      this.createCardsForList();
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  createCardsForList() {
    try {
      const accountArray = this.getAccountingItem().array;
      let accountItems;
      if (this.isFact) {
        accountItems = accountArray.filter(function (row) {
          return row.fact == 1
        });
      } else if (this.isBudget) {
        accountItems = accountArray.filter(function (row) {
          return row.budget == 1
        });
      } else if (this.isTarget) {
        accountItems = accountArray.filter(function (row) {
          return row.target == 1
        });
      }
      //* Информация по меткам
      const labelList = this.getBoardLabel(this.boardId);
      //* создание карточек на листе факт
      accountItems.forEach(function (accounts) {
        const label = labelList.reduce(function (row, arrya) {
          if (this.isMatch(accounts.color, arrya.color)) {
            row = arrya;
          }
          return row
        }, {});
        this.addCard(
          accounts.nomenclature,
          this.listId,
          accounts.id,
          label.id
        ).id;
      });
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  deleteEmptyRow() {
    try {
      const ss = this.trelloOpen;
      const ssMaxRows = ss.getMaxRows();
      const ssLastRow = ss.getLastRow();
      if (ssMaxRows - ssLastRow !== 0) {
        ss.deleteRows(ssLastRow + 1, ssMaxRows - ssLastRow);
      }
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  deleteRowByActionId(postObject) {
    try {
      //* удаление данных на листе источнике
      const ss = this.trelloOpen;
      const sourceData = this.trelloArray;
      const sum = sourceData.reduce(function (row, array) {
        if (this.isMatch(postObject.actionId, array[10])) {
          //? добавить массив: сумма, мвз
          row = array[8];
        }
        return row
      }, {});
      const sourceRows = sourceData.reduce(function (row, array, index) {
        if (this.isMatch(this.actionId, array[10])) {
          row.push(index + 1);
        }
        row.sort(function (a, b) {
          return b - a
        });
        return row
      }, []);
      sourceRows.forEach(function (row) {
        ss.deleteRow(row);
        //* удаление данных в массиве учета
        sourceData.splice(row - 1, 1);
      });
      this.dataTrello = this.getAllDataTrello(
        this.factPeriod,
        this.budgetPeriod
      );
      this.updateAccountData();
      return sum
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getAccountingItem() {
    //* получаение справочника статей
    try {
      const array = this.accountingItemArray;
      if (this.cardName == undefined) {
        this.cardName = '';
        this.cardLabelColor = '';
      }
      const object = {};
      object.array = array.reduce(function (row, array, index) {
        if (index != 0) {
          const object = {};
          object.id = array[0];
          object.cashFlow = array[1];
          object.bill = array[2];
          object.account = array[3];
          object.nomenclature = array[4];
          object.budget = array[5];
          object.fact = array[6];
          object.target = array[7];
          object.color = array[8];
          row.push(object);
        }
        return row
      }, []);
      object.item = object.array.reduce(function (row, array) {
        if (
          this.isMatch(this.cardName, array.nomenclature) &&
          this.isMatch(this.cardLabelColor, array.color)
        ) {
          row = array;
        }
        return row
      }, {});
      return object
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getAllTarget() {
    try {
      const array = this.targetArray;
      const target = this.getTarget().item;
      const object = {};
      object.array = array.reduce(function (row, array, index) {
        if (index != 0) {
          const object = {};
          object.timestamp = array[0];
          object.goal = array[1];
          object.cfo = array[2];
          object.startDate = new Date(array[3]);
          object.duration = +array[4];
          object.cost = +array[5];
          object.inflation = +array[6];
          object.endDate = new Date(array[7]);
          object.complete = array[8];
          object.budget = +array[9];
          object.newCost = +array[10];
          object.monthDeductionSum = +array[11];
          object.currentListedSum = +array[12];
          object.targetSum = +array[14];
          object.depositSum = +array[15];
          object.exchangeSum = +array[16];
          object.iisSum = +array[17];
          object.disbursedFunds = +array[18];
          object.inStock = +array[19];
          object.completePersent = +array[20];
          object.indexRow = index + 1;
          row.push(object);
        }
        return row
      }, []);
      object.item = object.array.reduce(function (row, array) {
        if (
          this.isMatch(target.goal, array.goal) &&
          this.isMatch(target.cfo, array.cfo)
        ) {
          row = array;
        }
        return row
      }, {});
      return object
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getComment(postObject) {
    try {
      const comment = {};
      const sum = this.getSum(postObject);
      if (this.isMatch(postObject.actionType, 'commentCard')) {
        comment.text =
          '**Внесенная сумма**: ' +
          postObject.sum +
          ' р.' +
          postObject.lineBreak;
        comment.message =
          '<b><u>' +
          postObject.cfo +
          '</u> внесено</b>: ' +
          postObject.sum +
          ' р.' +
          postObject.telegramLineBreak;
      } else if (this.isMatch(postObject.actionType, 'updateComment')) {
        comment.text =
          '**Новая сумма**: ' + postObject.sum + ' р.' + postObject.lineBreak;
        comment.message =
          '<b><u>' +
          postObject.cfo +
          '</u> изменено</b>: ' +
          postObject.sum +
          ' р.' +
          postObject.telegramLineBreak;
        comment.message +=
          '<i>Новое</i> - ' +
          postObject.sum +
          ' р.' +
          postObject.telegramLineBreak;
        comment.message +=
          '<i>Старое</i> - ' +
          postObject.oldSum +
          ' р.' +
          postObject.telegramLineBreak;
      } else if (this.isMatch(postObject.actionType, 'deleteComment')) {
        comment.text =
          '**Удаленная сумма**: ' +
          postObject.sum +
          ' р.' +
          postObject.lineBreak;
        comment.message =
          '<b><u>' +
          postObject.cfo +
          '</u> удалено</b>: ' +
          postObject.sum +
          ' р.' +
          postObject.telegramLineBreak;
      }
      if (postObject.isFact) {
        //* комментарий по факту
        comment.text +=
          '**Остаток средств** ' +
          '*' +
          postObject.cfo +
          '*: ' +
          sum.totalSum.totalRest +
          ' р.' +
          postObject.lineBreak;
        comment.text += '**Остаток бюджета**:' + postObject.lineBreak;
        comment.text +=
          '*Статья* - ' +
          postObject.account +
          ': ' +
          sum.totalSum.accountBudgetRest +
          ' р.' +
          postObject.lineBreak;
        comment.text +=
          '*Номенклатура* - ' +
          postObject.nomenclature +
          ': ' +
          sum.totalSum.nomenclatureBudgetRest +
          ' р.' +
          postObject.lineBreak;
        comment.message +=
          '<i>МВЗ</i> - ' + postObject.mvz + postObject.telegramLineBreak;
        comment.message +=
          '<b>Ост. ДС</b>: ' +
          sum.totalSum.totalRest +
          ' р.' +
          postObject.telegramLineBreak;
        comment.message += '<b>Ост. бюджета</b>:' + postObject.telegramLineBreak;
        comment.message +=
          '<i>' +
          postObject.account +
          '</i>: ' +
          sum.totalSum.nomenclatureBudgetRest +
          ' р.' +
          postObject.telegramLineBreak;
        comment.message +=
          '<i>' +
          postObject.nomenclature +
          '</i>: ' +
          sum.totalSum.accountBudgetRest +
          ' р.' +
          postObject.telegramLineBreak;
        if (this.isValidString(postObject.comment)) {
          comment.text += '**Комментарий**: ' + postObject.comment;
          comment.message += '<b>Комментарий</b>: ' + postObject.comment;
        }
      } else if (postObject.isBudget) {
        //* комментарий по бюджету
        comment.text += '**Бюджет**:' + postObject.lineBreak;
        comment.text +=
          '*Номенклатура* - ' +
          postObject.nomenclature +
          ': ' +
          sum.budgetSum.nomenclatureSum +
          ' р.' +
          postObject.lineBreak;
        comment.text +=
          '*Статья* - ' +
          postObject.account +
          ': ' +
          sum.budgetSum.accountSum +
          ' р.' +
          postObject.lineBreak;
        comment.text +=
          '*Счет* - ' +
          postObject.bill +
          ': ' +
          sum.budgetSum.billSum +
          ' р.' +
          postObject.lineBreak;
        comment.message +=
          '<i>МВЗ</i> - ' + postObject.mvz + postObject.telegramLineBreak;
        comment.message += '<b>Бюджет</b>:' + postObject.telegramLineBreak;
        comment.message +=
          '<i>Номенклатура</i> - ' +
          postObject.nomenclature +
          ': ' +
          sum.budgetSum.nomenclatureSum +
          ' р.' +
          postObject.telegramLineBreak;
        comment.message +=
          '<i>Статья</i> - ' +
          postObject.account +
          ': ' +
          sum.budgetSum.accountSum +
          ' р.' +
          postObject.telegramLineBreak;
        if (this.isValidString(postObject.comment)) {
          comment.text += '**Комментарий**: ' + postObject.comment;
          comment.message += '<b>Комментарий</b>: ' + postObject.comment;
        }
      } else if (postObject.isTarget) {
        //* комментарий по цели
        comment.text +=
          '*Счет* - ' + postObject.nomenclature + postObject.lineBreak;
        comment.text +=
          '*Старая сумма*: ' +
          postObject.targetSumOld +
          ' р.' +
          postObject.lineBreak;
        comment.text +=
          '*Новая сумма*: ' +
          postObject.targetSumNew +
          ' р.' +
          postObject.lineBreak;
        comment.text += '*Изменения*: ' + postObject.actionSum + ' р.';
        comment.message +=
          '<i>МВЗ</i> - ' + postObject.mvz + postObject.telegramLineBreak;
        comment.message +=
          '<i>Счет</i> - ' +
          postObject.nomenclature +
          postObject.telegramLineBreak;
        comment.message +=
          '<i>Старая сумма</i>: ' +
          postObject.targetSumOld +
          ' р.' +
          postObject.telegramLineBreak;
        comment.message +=
          '<i>Новая сумма</i>: ' +
          postObject.targetSumNew +
          ' р.' +
          postObject.telegramLineBreak;
        comment.message += '<i>Изменения</i>: ' + postObject.actionSum + ' р.';
      }
      return comment
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getCostСenter(postObject) {
    try {
      const array = postObject.costСenterArray;
      const object = {};
      object.array = array.reduce(function (row, array, index) {
        if (index != 0) {
          const object = {};
          object.id = array[0];
          object.mvz = array[1];
          object.tag = array[2];
          row.push(object);
        }
        return row
      }, []);
      object.item = object.array.reduce(
        function (row, array) {
          if (this.isMatch(postObject.comment, array.tag)) {
            row = array;
          }
          return row
        },
        {
          id: 0,
          mvz: postObject.cfo,
          tag: postObject.cfo,
        }
      );
      return object
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getDescription(postObject) {
    try {
      const description = {};
      const sum = this.getSum(this);
      description.text =
        '*Дата обновления*: ' +
        this.formatterDate(this.actionDate).time +
        this.lineBreak;
      if (this.isFact || this.isBudget) {
        if (this.isFact) {
          //* описание для фактических карточек
          description.text += '**По номенклатуре**: ' + this.lineBreak;
          description.text +=
            '*Остаток*: ' +
            sum.totalSum.nomenclatureBudgetRest +
            ' р.' +
            this.lineBreak;
          if (sum.totalSum.nomenclatureBudgetExecution != 0) {
            description.text +=
              '*Исполнение*: ' +
              sum.totalSum.nomenclatureBudgetExecution +
              this.encodeData('%', '%') +
              this.lineBreak;
          }
          description.text += '**По статье**: ' + this.lineBreak;
          description.text +=
            '*Остаток*: ' +
            sum.totalSum.accountBudgetRest +
            ' р.' +
            this.lineBreak;
          if (sum.totalSum.accountBudgetExecution != 0) {
            description.text +=
              '*Исполнение*: ' +
              sum.totalSum.accountBudgetExecution +
              this.encodeData('%', '%') +
              this.lineBreak;
          }
        } else if (this.isBudget) {
          if (!this.isMatch(this.nomenclature, 'Баланс')) {
            //* описание для бюджетных карточек
            description.text +=
              '**Итого бюджет на** *' +
              this.formatterDate(this.period).date +
              '*:' +
              this.lineBreak;
            description.text +=
              '*По операции*: ' +
              sum.budgetSum.cashFlowSum +
              ' р.' +
              this.lineBreak;
            description.text +=
              '*По счету*: ' + sum.budgetSum.billSum + ' р.' + this.lineBreak;
            description.text +=
              '*По статье*: ' +
              sum.budgetSum.accountSum +
              ' р.' +
              this.lineBreak;
            description.text +=
              '*По номенклатуре*: ' +
              sum.budgetSum.nomenclatureSum +
              ' р.' +
              this.lineBreak;
            if (this.isCurrBudget) {
              //* информация в рестроспективе за последние два месяца
              description.text += '**Факт прошлых периодов:**' + this.lineBreak;
              const previousFact = this.getPreviousFact();
              description.text +=
                this.formatterDate(this.factPeriod).date +
                ': ' +
                previousFact.Prev0.factSum.nomenclatureSum +
                ' р.' +
                this.lineBreak;
              description.text +=
                this.formatterDate(this.factPeriod1).date +
                ': ' +
                previousFact.Prev1.factSum.nomenclatureSum +
                ' р.' +
                this.lineBreak;
            }
          } else if (this.isMatch(this.nomenclature, 'Баланс')) {
            //* описание карточки баланса
            description.text +=
              '**Итоговый бюджет** *' +
              this.formatterDate(this.period).date +
              '* **по статьям**' +
              ':' +
              this.lineBreak;
            if (sum.budgetSum.groupAccount.length !== 0) {
              const groupBudgetRows = sum.budgetSum.groupAccount;
              groupBudgetRows.forEach(function (row) {
                description.text +=
                  row.bill +
                  ' - ' +
                  row.account +
                  ': ' +
                  row.sum +
                  ' р. ' +
                  this.lineBreak;
              });
            }
            description.text +=
              '**Остатки**: ' + sum.factSum.restSum + ' р.' + this.lineBreak;
            description.text +=
              '**Операционный бюджет**: ' +
              sum.budgetSum.costSum +
              ' р.' +
              this.lineBreak;
            description.text +=
              '**Бюджет отчислений**: ' +
              sum.budgetSum.accumulationBillExpenseSum +
              ' р.' +
              this.lineBreak;
            //* информация по переводам
            if (this.privateBudget) {
              description.text += '**Перечисления**: ' + this.lineBreak;
              description.text +=
                '*Первый перевод на счет Семьи*: ' +
                sum.totalSum.firstTransferToFamilyAccount +
                this.lineBreak;
              description.text +=
                '*Перечислить в накопления*: ' +
                sum.budgetSum.accumulationNomenclatureExpenseSum +
                this.lineBreak;
              description.text +=
                '*Снять с накоплений*: ' +
                sum.budgetSum.accumulationNomenclatureIncomeSum;
            }
          }
        }
        //* данные по бюджетным заявкам
        if (
          sum.budgetSum.nomenclatureRows.length != 0 &&
          !this.isMatch(this.nomenclature, 'Баланс')
        ) {
          const budgetRow = sum.budgetSum.nomenclatureRows;
          description.text += '**Бюджетные заявки**:' + this.lineBreak;
          let i = 1;
          budgetRow.forEach(function (row) {
            let comma;
            budgetRow.length > i ? (comma = this.lineBreak) : (comma = '');
            description.text +=
              this.formatterDate(row.actionDate).time +
              ': ' +
              row.sum +
              ' р. ' +
              row.comment +
              comma;
            i += 1;
          });
        }
        description.haveBudget = sum.totalSum.haveBudget;
      } else if (this.isTarget) {
        if (this.isMatch(this.nomenclature, 'Баланс')) {
          const targetItem = this.getAllTarget().item;
          description.text +=
            'Перечислено в т.м.: ' +
            targetItem.currentListedSum +
            ' р. ' +
            this.lineBreak;
          description.text +=
            'Цели: ' + targetItem.targetSum + ' р. ' + this.lineBreak;
          description.text +=
            'Депозит: ' + targetItem.depositSum + ' р. ' + this.lineBreak;
          description.text +=
            'Биржа: ' + targetItem.exchangeSum + ' р. ' + v.lineBreak;
          description.text +=
            'ИИС: ' + targetItem.iisSum + ' р. ' + this.lineBreak;
          description.text +=
            'Освоено: ' + targetItem.disbursedFunds + ' р. ' + this.lineBreak;
          description.text +=
            'В наличии: ' + targetItem.inStock + ' р. ' + this.lineBreak;
          description.text +=
            'Выполнено: ' +
            (targetItem.completePersent * 100).toFixed(2) +
            this.encodeData('%', '%');
        }
      }
      return description
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getFinancialСenter() {
    try {
      const array = this.financialСenterArray;
      const object = {};
      object.array = array.reduce(function (row, array, index) {
        if (index != 0) {
          const object = {};
          object.id = array[0];
          object.cfo = array[1];
          row.push(object);
        }
        return row
      }, []);
      object.item = object.array.reduce(function (row, array) {
        if (this.isMatch(this.listName, array.cfo)) {
          row = array;
        }
        return row
      }, {});
      return object
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @param {object} data
   */
  getParametr(data) {
    try {
      const array = data.parametrArray;
      const object = {};
      object.array = array.reduce(function (row, array, index) {
        if (index != 0) {
          const object = {};
          object.id = array[0];
          object.type = array[1];
          object.cfo = array[2];
          object.value = new Date(array[3]);
          object.indexRow = index + 1;
          row.push(object);
        }
        return row
      }, []);
      object.item = object.array.reduce(function (row, array) {
        if (
          this.isMatch(data.cfo, array.cfo) &&
          this.isMatch(data.type, array.type)
        ) {
          row = array;
        }
        return row
      }, {});
      return object
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getPeriod(data) {
    try {
      const date = {};
      if (data.isFact || data.isTarget) {
        const postObjectCopy = this.copyObject();
        postObjectCopy.type = 'Бюджет';
        date.factPeriod = this.getParametr(data).item.value;
        date.budgetPeriod = this.getParametr(postObjectCopy).item.value;
        date.factPeriod1 = new Date(
          date.factPeriod.getFullYear(),
          date.factPeriod.getMonth() - 1,
          1
        );
        date.factPeriod2 = new Date(
          date.factPeriod.getFullYear(),
          date.factPeriod.getMonth() - 2,
          1
        );
        date.budgetPeriod2 = new Date(
          date.budgetPeriod.getFullYear(),
          date.budgetPeriod.getMonth() + 1,
          1
        );
        date.budgetPeriod3 = new Date(
          date.budgetPeriod.getFullYear(),
          date.budgetPeriod.getMonth() + 2,
          1
        );
        if (
          this.getYMD(date.factPeriod).ymd ===
          this.getYMD(date.budgetPeriod).ymd
        ) {
          date.budgetPeriodCurrent = date.budgetPeriod;
        } else {
          date.budgetPeriodCurrent = date.factPeriod;
        }
      } else if (data.isBudget) {
        const postObjectCopy = this.copyObject();
        postObjectCopy.type = 'Факт';
        date.factPeriod = this.getParametr(postObjectCopy).item.value;
        date.budgetPeriod = this.getParametr(this).item.value;
        date.factPeriod1 = new Date(
          date.factPeriod.getFullYear(),
          date.factPeriod.getMonth() - 1,
          1
        );
        date.factPeriod2 = new Date(
          date.factPeriod.getFullYear(),
          date.factPeriod.getMonth() - 2,
          1
        );
        date.budgetPeriod2 = new Date(
          date.budgetPeriod.getFullYear(),
          date.budgetPeriod.getMonth() + 1,
          1
        );
        date.budgetPeriod3 = new Date(
          date.budgetPeriod.getFullYear(),
          date.budgetPeriod.getMonth() + 2,
          1
        );
        if (this.isMatch(data.boardId, data.boardIdBudget)) {
          date.budgetPeriodCurrent = date.budgetPeriod;
        } else if (this.isMatch(data.boardId, data.boardIdBudget2)) {
          date.budgetPeriodCurrent = date.budgetPeriod2;
        } else if (this.isMatch(data.boardId, data.boardIdBudget3)) {
          date.budgetPeriodCurrent = date.budgetPeriod3;
        }
      }
      if (this.isMatch(data.boardId, data.boardIdFact)) {
        date.period = date.factPeriod;
      } else if (this.isMatch(data.boardId, data.boardIdFact0)) {
        date.period = date.factPeriod1;
      } else if (this.isMatch(data.boardId, data.boardIdBudget)) {
        date.period = date.budgetPeriod;
      } else if (this.isMatch(data.boardId, data.boardIdBudget2)) {
        date.period = date.budgetPeriod2;
      } else if (this.isMatch(data.boardId, data.boardIdBudget3)) {
        date.period = date.budgetPeriod3;
      } else if (this.isMatch(data.boardId, data.boardIdTarget)) {
        date.period = date.factPeriod;
      }
      date.ymd = this.getYMD(date.period).ymd;
      return date
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @param {object} data
   */
  getSum(data) {
    try {
      const sum = {};
      const totalSum = {};
      const budgetSum = this.getTotalSum(data, data.dataTrello.current.budget);
      const factSum = this.getTotalSum(data, data.dataTrello.current.fact);
      totalSum.totalRest =
        factSum.restSum + factSum.incomeSum - factSum.expenseSum;
      totalSum.billBudgetRest = budgetSum.billSum - factSum.billSum;
      totalSum.accountBudgetRest = budgetSum.accountSum - factSum.accountSum;
      totalSum.nomenclatureBudgetRest =
        budgetSum.nomenclatureSum - factSum.nomenclatureSum;
      let transferCoef;
      if (this.isMatch(data.cfo, 'Илья')) {
        transferCoef = (70 / 100).toFixed(2);
      } else if (this.isMatch(postObject.cfo, 'Оксана')) {
        transferCoef = 1;
      } else {
        transferCoef = 1;
      }
      totalSum.firstTransferToFamilyAccount = (
        factSum.restSum +
        budgetSum.salarySum +
        budgetSum.accumulationNomenclatureIncomeSum -
        (budgetSum.expenseSum - budgetSum.transferToFamilyAccountSum) *
          transferCoef
      ).toFixed(0);
      if (factSum.nomenclatureSum != 0 && budgetSum.nomenclatureSum != 0) {
        totalSum.nomenclatureBudgetExecution = (
          (factSum.nomenclatureSum / budgetSum.nomenclatureSum) *
          100
        ).toFixed(2);
      } else {
        totalSum.nomenclatureBudgetExecution = 0;
      }
      if (factSum.accountSum != 0 && budgetSum.accountSum != 0) {
        totalSum.accountBudgetExecution = (
          (factSum.accountSum / budgetSum.accountSum) *
          100
        ).toFixed(2);
      } else {
        totalSum.accountBudgetExecution = 0;
      }
      budgetSum.nomenclatureRows.length != 0
        ? (totalSum.haveBudget = true)
        : (totalSum.haveBudget = false);
      sum.budgetSum = budgetSum;
      sum.factSum = factSum;
      sum.totalSum = totalSum;
      return sum
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getTarget() {
    try {
      const array = this.goalsArray;
      const object = {};
      object.array = array.reduce(function (row, array, index) {
        if (index != 0) {
          const object = {};
          object.id = array[0];
          object.listName = array[1];
          object.goal = array[2];
          object.cfo = array[3];
          object.listId = array[5];
          object.status = array[6];
          object.indexRow = index + 1;
          row.push(object);
        }
        return row
      }, []);
      object.item = object.array.reduce(function (row, array) {
        if (this.isMatch(this.listName, array.listName)) {
          row = array;
        }
        return row
      }, {});
      return object
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @param {object} data
   * @param {array} array
   */
  getTotalSum(data, array) {
    try {
      const filterSum = array.reduce(function (sum, array, index) {
        if (index === 0) {
          sum = {};
          sum.cashFlowSum = 0;
          sum.billSum = 0;
          sum.accountSum = 0;
          sum.nomenclatureSum = 0;
          sum.incomeSum = 0;
          sum.accumulationBillIncomeSum = 0;
          sum.accumulationNomenclatureIncomeSum = 0;
          sum.salarySum = 0;
          sum.expenseSum = 0;
          sum.costSum = 0;
          sum.accumulationBillExpenseSum = 0;
          sum.transferBillExpenseSum = 0;
          sum.accumulationNomenclatureExpenseSum = 0;
          sum.transferToFamilyAccountSum = 0;
          sum.restSum = 0;
        }
        if (this.isMatch(array.cfo, data.cfo)) {
          if (this.isMatch(array.cashFlow, data.cashFlow)) {
            //* сумма по операции
            sum.cashFlowSum += array.sum;
            if (this.isMatch(array.bill, data.bill)) {
              //* сумма по счету
              sum.billSum += array.sum;
              if (this.isMatch(array.account, data.account)) {
                //* сумма по статье
                sum.accountSum += array.sum;
                if (this.isMatch(array.nomenclature, data.nomenclature)) {
                  //* сумма по номенклатуре
                  sum.nomenclatureSum += array.sum;
                }
              }
            }
          }
          if (this.isMatch(array.cashFlow, 'Пополнение')) {
            //* сумма по операции пополнение
            sum.incomeSum += array.sum;
            if (this.isMatch(array.bill, 'Накопления')) {
              //* сумма по статье накопления в приходах
              sum.accumulationBillIncomeSum += array.sum;
            }
            if (this.isMatch(array.nomenclature, 'Уменьшение накоплений')) {
              //* сумма по номенклатуре накопления в приходах
              sum.accumulationNomenclatureIncomeSum += array.sum;
            }
            if (this.isMatch(array.nomenclature, 'Зарплата')) {
              //* сумма по зарплате
              sum.salarySum += array.sum;
            }
          } else if (this.isMatch(array.cashFlow, 'Списание')) {
            //* сумма по операции списание
            sum.expenseSum += array.sum;
            if (this.isMatch(array.bill, 'Затраты')) {
              //* сумма по статье затраты
              sum.costSum += array.sum;
            } else if (this.isMatch(array.bill, 'Накопления')) {
              //* сумма по статье накопления в расходах
              sum.accumulationBillExpenseSum += array.sum;
            } else if (this.isMatch(array.bill, 'Переводы')) {
              //* сумма по статье переводы в расходах
              sum.transferBillExpenseSum += array.sum;
            }
            if (this.isMatch(array.nomenclature, 'Увеличение накоплений')) {
              //* сумма по номенклатуре накопления в расходах
              sum.accumulationNomenclatureExpenseSum += array.sum;
            } else if (
              this.isMatch(array.nomenclature, 'Перевод на счет Семья')
            ) {
              //* сумма по переводу на счет семьи
              sum.transferToFamilyAccountSum += array.sum;
            }
          } else if (this.isMatch(array.cashFlow, 'Остатки')) {
            //* сумма по операции остатки
            sum.restSum += array.sum;
          }
        }
        return sum
      }, {});
      let total = {};
      total = Object.assign({}, filterSum);
      //* данные по статьям с агрегацией
      const groupAccount = array.reduce(function (newArray, array) {
        if (this.isMatch(array.cfo, data.cfo)) {
          if (!newArray[array.account]) {
            newArray[array.account] = {};
            newArray[array.account].bill = array.bill;
            newArray[array.account].account = array.account;
            newArray[array.account].sum = 0;
          }
          newArray[array.account].sum += array.sum;
        }
        return newArray
      }, {});
      total.groupAccount = Object.keys(groupAccount).map(function (k) {
        const item = groupAccount[k];
        return {
          bill: item.bill,
          account: item.account,
          sum: item.sum,
        }
      });
      total.groupAccount.sort(function (a, b) {
        const nameA = a.bill.toLowerCase();
        const nameB = b.bill.toLowerCase();
        if (nameA < nameB) {
          // сортируем строки по возрастанию
          return -1
        } else if (nameA > nameB) {
          return 1
        } else {
          return 0
        } // Никакой сортировки
      });
      //* данные по счету с агрегацией
      const groupBill = array.reduce(function (newArray, array) {
        if (this.isMatch(array.cfo, data.cfo)) {
          if (!newArray[array.bill]) {
            newArray[array.bill] = {};
            newArray[array.bill].bill = array.bill;
            newArray[array.bill].sum = 0;
          }
          newArray[array.bill].sum += array.sum;
        }
        return newArray
      }, {});
      total.groupBill = Object.keys(groupBill).map(function (k) {
        const item = groupBill[k];
        return {
          bill: item.bill,
          sum: item.sum,
        }
      });
      //* данные из учета
      total.nomenclatureRows = array.filter(function (array) {
        return (
          this.isMatch(array.cfo, data.cfo) &&
          this.isMatch(array.bill, data.bill) &&
          this.isMatch(array.account, data.account) &&
          this.isMatch(array.nomenclature, data.nomenclature) &&
          this.isMatch(array.cashFlow, data.cashFlow)
        )
      });
      return total
    } catch (e) {
      // addErrorItem(arguments.callee.name + ': ' + e)
    }
  }

  /**
   * @param {object} data
   */
  isOldData(data) {
    try {
      //* добавление строк на страницу
      const targetArray = data.dataTrello.all;
      return targetArray.reduce(function (row, array) {
        if (this.isMatch(array.actionId, data.actionId)) {
          row = true;
        }
        return row
      }, false)
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  parseComment(postObject) {
    try {
      const parseData = {};
      const text = postObject.text;
      parseData.sum = +text.match(/^\d+/);
      parseData.comment = text
        .split(parseData.sum)
        .join('')
        .replace(/^[.,\,, ,\-,\/,\\]/, ' ')
        .trim();
      return parseData
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  updateBalanceCard() {
    /*
     * @postObject - данные реквеста
     */
    try {
      //* обновление карточки баланса
      const postObjectBalance = this.copyObject();
      postObjectBalance.nomenclature = 'Баланс';
      const balanceCard = this.getCards(
        postObjectBalance.listId,
        postObjectBalance.nomenclature
      ).item;
      postObjectBalance.cardId = balanceCard.id;
      this.addCardComment(
        postObjectBalance.cardId,
        postObjectBalance.cardComment
      );
      if (postObjectBalance.isBudget || postObjectBalance.isTarget) {
        const description = this.getDescription(postObjectBalance);
        postObjectBalance.cardDescription = description.text;
        this.updateCardDesc(postObjectBalance);
      }
      postObjectBalance.telegramChatId.forEach(function (id) {
        postObjectBalance.telegramChatId = id;
        this.sendMessageTelegram(postObjectBalance);
      });
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  updateDescForNewCards() {
    try {
      const cards = this.getCards().array;
      const postObjectCard = this.copyObject();
      postObjectCard.dataTrello = this.getAllDataTrello();
      //* обновление описание карточки
      cards.forEach(function (card) {
        postObjectCard.cardId = card.id;
        postObjectCard.cardName = card.name;
        postObjectCard.cardLabelColor = getCardLabel().item.color;
        postObjectCard.accountingItem = getAccountingItem(postObjectCard);
        postObjectCard.cashFlow = postObjectCard.accountingItem.item.cashFlow;
        postObjectCard.bill = postObjectCard.accountingItem.item.bill;
        postObjectCard.account = postObjectCard.accountingItem.item.account;
        postObjectCard.nomenclature = card.name;
        const description = this.getDescription(postObjectCard);
        if (description.haveBudget) {
          postObjectCard.cardDescription = description.text;
          this.updateCardDesc(postObjectCard);
        }
      });
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  updateParametr() {
    try {
      const ss = this.parametrSheetOpen;
      let indexRow;
      let value;
      const postObjectCopy = this.copyObject();
      if (this.isCurrFact) {
        postObjectCopy.type = 'Факт';
        indexRow = this.getParametr(postObjectCopy).item.indexRow;
        value = new Date(
          postObjectCopy.factPeriod.getFullYear(),
          postObjectCopy.factPeriod.getMonth() + 1,
          1
        );
        ss.getRange(indexRow, 4).setValue(formatterDate(value).date);
        ss.getRange(indexRow, 5).setValue(formatterDate().timestamp);
      } else if (postObject.isCurrBudget) {
        postObjectCopy.isFact = false;
        postObjectCopy.isBudget = true;
        postObjectCopy.type = 'Бюджет';
        indexRow = this.getParametr(postObjectCopy).item.indexRow;
        value = new Date(
          postObjectCopy.budgetPeriod.getFullYear(),
          postObjectCopy.budgetPeriod.getMonth() + 1,
          1
        );
        ss.getRange(indexRow, 4).setValue(formatterDate(value).date);
        ss.getRange(indexRow, 5).setValue(formatterDate().timestamp);
      }
      this.parametrArray = this.getGoogleSheetValues(this.parametrSheetOpen);
      this.date = this.getPeriod(postObjectCopy);
      this.period = this.date.period;
      this.ymd = this.date.ymd;
      this.factPeriod1 = this.date.factPeriod1;
      this.factPeriod = this.date.factPeriod;
      this.budgetPeriod = this.date.budgetPeriod;
      this.budgetPeriod2 = this.date.budgetPeriod2;
      this.budgetPeriod3 = this.date.budgetPeriod3;
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  updateRowByActionId(postObject) {
    /*
     * @postObject - данные реквеста
     * */
    try {
      const sourceRowIndex = [];
      //* обновление данных на листе источнике
      const ss = postObject.trelloOpen;
      const sourceData = postObject.trelloArray;
      sourceData.reduce(function (row, array, index) {
        if (this.isMatch(array[10], postObject.actionId)) {
          row = index + 1;
          sourceRowIndex.push(row);
        }
        return row
      }, []);
      sourceRowIndex.forEach(function (row) {
        ss.getRange(row, 1).setValue(postObject.actionDate);
        ss.getRange(row, 4).setValue(postObject.mvz);
        ss.getRange(row, 9).setValue(postObject.sum);
        ss.getRange(row, 10).setValue(postObject.comment);
      });
      //* обновление данных в массиве источника
      sourceData.map(function (array) {
        if (this.isMatch(array[10], postObject.actionId)) {
          array[0] = postObject.actionDate;
          array[1] = postObject.mvz;
          array[8] = postObject.sum;
          array[9] = postObject.comment;
        }
      });
      postObject.dataTrello = this.getAllDataTrello(postObject);
      this.updateAccountData();
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  updateTarget(postObject) {
    /*
     * @postObject - входные параметра запроса
     * @value - значение параметра. Изменяемое
     * */
    try {
      const ss = postObject.goalsSheetOpen;
      const indexRow = this.getTarget(postObject).item.indexRow;
      ss.getRange(indexRow, 5).setValue(formatterDate().timestamp);
      ss.getRange(indexRow, 7).setValue('closed');
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  updateTrelloData(postObject) {
    try {
      let insertdate;
      //* вставка значений в буфер
      const ss = this.trelloOpen;
      const trelloArray = this.trelloArray;
      let pushBufferRow = [
        this.actionDate,
        this.period,
        this.cfo,
        this.mvz,
        this.cashFlow,
        this.bill,
        this.account,
        this.nomenclature,
        this.sum,
        this.comment,
        this.actionId,
        this.type,
      ];
      ss.appendRow(pushBufferRow);
      trelloArray.push(pushBufferRow);
      //* Проверка перевода на счет семьи
      if (this.isMatch(this.account, 'Перевод на счет Семья')) {
        insertdate = new Date(this.actionDate.getTime() + 1000);
        if (this.isMatch(this.cfo, 'Илья')) {
          pushBufferRow = [
            insertdate,
            this.period,
            'Семья',
            'Семья',
            'Пополнение',
            'Переводы',
            'Приход со счета Илья',
            'Приход со счета Илья',
            this.sum,
            this.comment,
            this.actionId,
            this.type,
          ];
          ss.appendRow(pushBufferRow);
          trelloArray.push(pushBufferRow);
        } else if (this.isMatch(this.cfo, 'Оксана')) {
          pushBufferRow = [
            insertdate,
            this.period,
            'Семья',
            'Семья',
            'Пополнение',
            'Переводы',
            'Приход со счета Оксана',
            'Приход со счета Оксана',
            this.sum,
            this.comment,
            this.actionId,
            this.type,
          ];
          ss.appendRow(pushBufferRow);
          trelloArray.push(pushBufferRow);
        }
      }
      //* добавление данных в отчет
      const reportRow = [
        this.actionDate,
        this.period,
        this.cfo,
        this.mvz,
        this.cashFlow,
        this.bill,
        this.account,
        this.nomenclature,
        this.sum,
        this.comment,
        this.actionId,
        this.type,
      ];
      const wsReport = this.SpreadsheetApp.openById(
        '1KDKD7VKQbgiRNhGanH0j7WUO__rLrky1xWVeBK90xbE'
      ).getSheetByName('Учет');
      wsReport.appendRow(reportRow);
      //* получение данных учета после обновления
      this.dataTrello = this.getAllDataTrello(
        this.factPeriod,
        this.budgetPeriod
      );
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  updateTargetList(postObject) {
    try {
      const targetItem = this.getAllTarget(postObject).item;
      const ssTargetOpen = postObject.targetOpen;
      let targetColumn;
      let targetSumOld;
      let targetSumNew;
      let actionSum;
      if (this.isMatch(postObject.bill, 'Накопления')) {
        if (this.isMatch(postObject.account, 'Цели')) {
          targetColumn = 15;
          targetSumOld = targetItem.targetSum;
        } else if (this.isMatch(postObject.account, 'Депозит')) {
          targetColumn = 16;
          targetSumOld = targetItem.depositSum;
        } else if (this.isMatch(postObject.account, 'Биржа')) {
          targetColumn = 17;
          targetSumOld = targetItem.exchangeSum;
        } else if (this.isMatch(postObject.account, 'ИИС')) {
          targetColumn = 18;
          targetSumOld = targetItem.iisSum;
        }
        //? продумать как определять цель при списании в затраты
      } else if (this.isMatch(postObject.bill, 'Затраты')) {
        if (this.isMatch(targetItem.goal, postObject.mvz)) {
          targetColumn = 19;
          targetSumOld = targetItem.disbursedFunds;
        }
      }
      if (this.isMatch(postObject.actionType, 'commentCard')) {
        actionSum = postObject.sum;
      } else if (this.isMatch(postObject.actionType, 'deleteComment')) {
        actionSum = -1 * postObject.sum;
      } else if (this.isMatch(postObject.actionType, 'updateComment')) {
        actionSum = postObject.sum - postObject.oldSum;
      }
      if (this.isMatch(postObject.cashFlow, 'Списание')) {
        targetSumNew = targetSumOld + actionSum;
      } else if (this.isMatch(postObject.cashFlow, 'Пополнение')) {
        targetSumNew = targetSumOld - actionSum;
      }
      ssTargetOpen
        .getRange(targetItem.indexRow, targetColumn)
        .setValue(+targetSumNew);
      postObject.targetArray = this.getGoogleSheetValues(postObject.targetOpen);
      postObject.targetSumOld = targetSumOld;
      postObject.targetSumNew = targetSumNew;
      postObject.actionSum = actionSum;
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   *
   * @param {date} factPeriod
   * @param {date} budgetPeriod
   */
  getAllDataTrello(factPeriod, budgetPeriod) {
    try {
      const data = this.trelloArray;
      const object = {};
      object.all = data.reduce(function (row, array, index) {
        if (index != 0) {
          const object = {};
          //* данные из буфера трелло
          object.actionDate = array[0];
          object.period = array[1];
          object.ymd = this.getYMD(array[1]).ymd;
          object.cfo = array[2];
          object.mvz = array[3];
          object.cashFlow = array[4];
          object.bill = array[5];
          object.account = array[6];
          object.nomenclature = array[7];
          object.sum = array[8];
          object.comment = array[9];
          object.actionId = array[10];
          object.type = array[11];
          object.indexRow = index + 1;
          row.push(object);
        }
        return row
      }, []);
      object.current = {};
      object.current.fact = object.all.filter(function (row) {
        return (
          row.ymd == this.getYMD(factPeriod).ymd &&
          this.isMatch(row.type, 'Факт')
        )
      });
      object.current.budget = object.all.filter(function (row) {
        return (
          row.ymd == this.getYMD(budgetPeriod).ymd &&
          this.isMatch(row.type, 'Бюджет')
        )
      });
      return object
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  /**
   * @returns
   */
  getPreviousFact() {
    try {
      const sum = { Prev0, Prev1 };
      const dataTrelloPrev0 = this.copyObject();
      dataTrelloPrev0.dataTrello = this.getAllDataTrello(
        this.factPeriod,
        this.budgetPeriod
      );
      sum.Prev0 = this.getSum(dataTrelloPrev0);
      const dataTrelloPrev1 = this.copyObject();
      dataTrelloPrev1.dataTrello = this.getAllDataTrello(
        this.factPeriod1,
        this.budgetPeriod
      );
      sum.Prev1 = this.getSum(dataTrelloPrev1);
      return sum
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  isUser(postData) {
    try {
      const botUser = ['5e2b5f3f409c544ebdb1b9d4'];
      return botUser.reduce(function (row, array) {
        if (this.isMatch(array, postData.action.memberCreator.id)) {
          row = false;
        }
        return row
      }, true)
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  isValidateAction(postData) {
    try {
      const actionType = [
        'commentCard',
        'updateComment',
        'deleteComment',
        'createList',
        'updateList',
        'updateCard',
      ];
      return actionType.reduce(function (row, array) {
        if (this.isMatch(postData.action.type, array)) {
          if (this.isMatch(postData.action.type, 'updateCard')) {
            if (this.isMatch(postData.action.data.card.name, 'Баланс')) {
              row = true;
            }
          } else {
            row = true;
          }
        }
        return row
      }, false)
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  addList(listName, boardId) {
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          'lists/?name=' +
          listName +
          '&idBoard=' +
          boardId +
          '&' +
          this.keyAndToken,
        data
      );
      var variable = {};
      variable.id = JSON.parse(resp).id;
      variable.name = JSON.parse(resp).name;
      return variable
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  closedList(postObject) {
    /*
     * @postObject - входные параметра запроса
     * @listId - входной параметр ID листа trello
     **/
    try {
      var data = {
        method: 'put',
        contentType: 'application/json',
      };
      this.fetch(
        this.apiRoot +
          'lists/' +
          postObject.listId +
          '/closed?value=true&' +
          this.keyAndToken,
        data
      );
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  copyList(postObject, postObjectNew) {
    /*
     * @postObject - входные параметра запроса
     * @postObjectNew - входной параметр обновленные
     **/
    try {
      var data = {
        method: 'post',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          'lists/?name=' +
          postObjectNew.listName +
          '&idBoard=' +
          postObjectNew.boardId +
          '&idListSource=' +
          postObject.idListSource +
          '&pos=bottom&' +
          this.keyAndToken,
        data
      );
      var variable = {};
      variable.id = JSON.parse(resp).id;
      variable.name = JSON.parse(resp).name;
      return variable
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  getList(postObject) {
    try {
      var data = {
        method: 'get',
        contentType: 'application/json',
      };
      var resp = this.fetch(
        this.apiRoot +
          'boards/' +
          postObject.boardId +
          '/lists?cards=none&' +
          this.keyAndToken,
        data
      );
      var respData = JSON.parse(resp);
      var listArray = {};
      respData.reduce(function (variable, array) {
        var listName = array.name;
        var postObjectCfo = postObject.cfo;
        if (listName.toLowerCase().match(postObjectCfo.toLowerCase())) {
          variable = {};
          variable.id = array.id;
          variable.name = array.name;
          listArray = variable;
        }
      }, {});
      return listArray
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  moveList(postObject, postObjectNew) {
    try {
      var data = {
        method: 'put',
        contentType: 'application/json',
      };
      this.fetch(
        this.apiRoot +
          'lists/' +
          postObject.listId +
          '/idBoard?value=' +
          postObjectNew.boardId +
          '&' +
          this.keyAndToken,
        data
      );
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  updateList(listId, listName) {
    try {
      var data = {
        method: 'put',
        contentType: 'application/json',
      };
      this.fetch(
        this.apiRoot +
          'lists/' +
          listId +
          '?name=' +
          listName +
          '&' +
          this.keyAndToken,
        data
      );
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }

  sendMessageTelegram(postObject) {
    try {
      const data = {
        method: 'post',
        payload: {
          method: 'sendMessage',
          chat_id: postObject.telegramChatId,
          text: postObject.telegramMessage,
          parse_mode: 'HTML',
        },
      };
      this.fetch(postObject.telegramUrl, data);
    } catch (e) {
      this.addErrorItem(arguments.callee.name + ': ' + e);
    }
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    if (this.addLog(postData)) {
      // var postObject =
      this.getPostObject(postData);
      if (this.isMatch(this.actionType, 'commentCard')) {
        //* добавление информации
        this.updateTrelloData(this);
        if (this.isTarget) {
          //* обновление листа цель
          this.updateTargetList(this);
        }
        //* получение описание карточки и комментария
        this.cardDescription = this.getDescription(this).text;
        const comment = this.getComment(this);
        this.cardComment = comment.text;
        this.telegramMessage = comment.message;
        //* обновление описание карточки
        this.updateCardDesc(this);
        //* обновление карточки баланса
        this.updateBalanceCard(this);
      } else if (
        this.isMatch(this.actionType, 'updateComment') &&
        this.isOldData
      ) {
        //* обновление данных при изменении комментария
        this.updateRowByActionId(this);
        if (this.isTarget) {
          //* обновление листа цель
          this.updateTargetList(this);
        }
        this.cardDescription = this.getDescription(this).text;
        const comment = this.getComment(this);
        this.cardComment = comment.text;
        this.telegramMessage = comment.message;
        //* обновление описание карточки
        this.updateCardDesc(this);
        //* обновление карточки баланса
        this.updateBalanceCard(this);
      } else if (
        this.isMatch(this.actionType, 'deleteComment') &&
        this.isOldData
      ) {
        //* удаление строки при удалении комментария
        this.sum = this.deleteRowByActionId(this);
        if (this.isTarget) {
          //* обновление листа цель
          this.updateTargetList(this);
        }
        this.cardDescription = this.getDescription(this).text;
        const comment = this.getComment(this);
        this.cardComment = comment.text;
        this.telegramMessage = comment.message;
        //* обновление описание карточки
        this.updateCardDesc(this);
        //* обновление карточки баланса
        this.updateBalanceCard(this);
      } else if (this.isMatch(this.actionType, 'createList')) {
        if (this.isFact || this.isBudget) {
          this.addFinancialCenter(this);
          this.cfo = this.listName;
          if (this.isFact) {
            this.type = 'Факт';
          } else if (this.isBudget) {
            this.type = 'Бюджет';
          }
          this.createCardsForList(this);
          this.updateDescForNewCards();
        } else if (this.isTarget) {
          this.addTarget(this);
          this.createCardsForList(this);
        }
      } else if (this.isMatch(this.actionType, 'updateList')) {
        if (this.isTarget && this.listClosed) {
          this.updateTarget(this);
        }
      } else if (this.isMatch(this.actionType, 'updateCard')) {
        if (this.cardClosed && this.isMatch(this.cardName, 'Баланс')) {
          if (this.isCurrFact) {
            //* закрытие фактического периода
            this.updateParametr();
            this.closedFactPeriod();
            this.updateDescForNewCards();
          } else if (this.isCurrBudget) {
            //* закрытие бюджетного периода
            this.updateParametr();
            this.closedBudgetPeriod();
          }
        }
      }
      //* удаление старых логов
      this.deleteLog();
      //* удаление старых ошибок
      this.deleteError();
      //* Удаление пустых строк
      this.deleteEmptyRow();
    }
  } catch (e) {
    this.addErrorItem(arguments.callee.name + ': ' + e);
  } finally {
    if (this.isMatch(this.actionType, 'commentCard')) {
      //* добавление реакции на комментарий
      this.addCardReaction();
    }
  }
}
