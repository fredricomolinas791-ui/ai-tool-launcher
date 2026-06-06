import { useState, useMemo } from 'react';
import { Calculator, Search, Copy, Check, BookOpen, Lightbulb } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';

interface Formula {
  id: string;
  name: { zh: string; en: string };
  category: 'lookup' | 'math' | 'text' | 'date' | 'logic' | 'stats';
  syntax: string;
  desc: { zh: string; en: string };
  example: string;
  result: string;
  tips: { zh: string[]; en: string[] };
  difficulty: 1 | 2 | 3;
}

/* ─────────── 100+ 真实 Excel 公式 ─────────── */
const FORMULAS: Formula[] = [
  // ═══════ 查找引用类(11 个)═══════
  { id: 'vlookup', name: { zh: 'VLOOKUP 垂直查找', en: 'VLOOKUP' }, category: 'lookup', syntax: 'VLOOKUP(查找值, 表格区域, 列序号, [匹配模式])', desc: { zh: '在表格第一列查找值,返回同一行其他列的数据', en: 'Look up a value in the first column and return a value in the same row' }, example: '=VLOOKUP("张三", A2:D100, 3, FALSE)', result: '返回 A 列中"张三"所在行第 3 列(D 列)的值', tips: { zh: ['FALSE = 精确匹配,TRUE = 近似匹配(默认)', '查找值必须在表格的第一列', '列序号从 1 开始,不是从 0', '建议用 XLOOKUP 替代(Excel 365)'], en: ['FALSE = exact match, TRUE = approximate (default)', 'Lookup value must be in the first column', 'Column index starts at 1, not 0', 'Prefer XLOOKUP in Excel 365'] }, difficulty: 2 },
  { id: 'xlookup', name: { zh: 'XLOOKUP 现代查找', en: 'XLOOKUP' }, category: 'lookup', syntax: 'XLOOKUP(查找值, 查找数组, 返回数组, [未找到值], [匹配模式], [搜索模式])', desc: { zh: 'VLOOKUP 的现代替代,支持任意方向查找', en: 'Modern replacement for VLOOKUP with bidirectional lookup' }, example: '=XLOOKUP("苹果", A2:A100, B2:B100, "未找到")', result: '在 A 列找"苹果",返回对应 B 列的值;找不到返回"未找到"', tips: { zh: ['Excel 365 / 2021+ 才支持', '可以向左查找(突破 VLOOKUP 限制)', '默认精确匹配,不用 FALSE', '性能比 VLOOKUP 更好'], en: ['Excel 365 / 2021+ only', 'Can look left (overcomes VLOOKUP limitation)', 'Exact match by default', 'Better performance than VLOOKUP'] }, difficulty: 2 },
  { id: 'index-match', name: { zh: 'INDEX + MATCH 组合', en: 'INDEX + MATCH' }, category: 'lookup', syntax: 'INDEX(返回区域, MATCH(查找值, 查找区域, 0))', desc: { zh: '经典查找组合,比 VLOOKUP 更灵活', en: 'Classic lookup combo, more flexible than VLOOKUP' }, example: '=INDEX(C2:C100, MATCH("李四", B2:B100, 0))', result: '在 B 列找"李四",返回 C 列对应位置的值', tips: { zh: ['不要求查找值在第一列', '列位置变化不影响公式', '大数据量比 VLOOKUP 更快', '可以左右双向查找'], en: ['Lookup value not required to be in first column', 'Position changes don\'t break the formula', 'Faster than VLOOKUP on large datasets', 'Bidirectional lookup'] }, difficulty: 3 },
  { id: 'hlookup', name: { zh: 'HLOOKUP 水平查找', en: 'HLOOKUP' }, category: 'lookup', syntax: 'HLOOKUP(查找值, 表格区域, 行序号, [匹配模式])', desc: { zh: '在表格第一行查找值,返回同一列其他行的数据', en: 'Look up a value in the first row and return a value in the same column' }, example: '=HLOOKUP("Q1", A1:Z5, 3, FALSE)', result: '在第一行找"Q1",返回第 3 行的值', tips: { zh: ['VLOOKUP 的水平版本', '适用于横向布局的表格', '不常用,推荐用 INDEX+MATCH'], en: ['Horizontal version of VLOOKUP', 'Use for horizontal layouts', 'Prefer INDEX+MATCH'] }, difficulty: 2 },
  { id: 'match', name: { zh: 'MATCH 位置查找', en: 'MATCH' }, category: 'lookup', syntax: 'MATCH(查找值, 查找数组, [匹配模式])', desc: { zh: '返回查找值在数组中的位置(数字)', en: 'Return the position of a value in an array' }, example: '=MATCH("苹果", A1:A10, 0)', result: '返回"苹果"在 A1:A10 中的行号(精确匹配)', tips: { zh: ['0=精确,1=小于等于(需升序),-1=大于等于(需降序)', '常配合 INDEX 替代 VLOOKUP'], en: ['0=exact, 1=less-or-equal (sorted asc), -1=greater-or-equal (desc)', 'Often paired with INDEX instead of VLOOKUP'] }, difficulty: 2 },
  { id: 'offset', name: { zh: 'OFFSET 偏移引用', en: 'OFFSET' }, category: 'lookup', syntax: 'OFFSET(基准, 行偏移, 列偏移, [高度], [宽度])', desc: { zh: '以基准单元格为起点偏移,返回动态区域', en: 'Return a dynamic range offset from a reference' }, example: '=OFFSET(A1, 2, 3, 1, 1)', result: '返回 D3(从 A1 偏移 2 行 3 列)', tips: { zh: ['易失性函数(每次重算都更新)', '动态图表常用', '用 INDIRECT 替代可避免易失性'], en: ['Volatile function (recalculates on every change)', 'Common in dynamic charts', 'Use INDIRECT for non-volatile alternative'] }, difficulty: 3 },
  { id: 'indirect', name: { zh: 'INDIRECT 间接引用', en: 'INDIRECT' }, category: 'lookup', syntax: 'INDIRECT(引用字符串, [样式])', desc: { zh: '把字符串转换为单元格引用', en: 'Convert a text string into a cell reference' }, example: '=INDIRECT("Sheet"&B1&"!A1")', result: '根据 B1 的值动态引用不同 sheet 的 A1', tips: { zh: ['非易失性(比 OFFSET 好)', '常用于动态下拉列表', '字符串拼写错误会返回 #REF!'], en: ['Non-volatile (better than OFFSET)', 'Often used for dynamic dropdowns', 'Bad string returns #REF!'] }, difficulty: 3 },
  { id: 'choose', name: { zh: 'CHOOSE 选择', en: 'CHOOSE' }, category: 'lookup', syntax: 'CHOOSE(索引, 值1, 值2, ...)', desc: { zh: '根据索引从一组值中选一个', en: 'Pick a value from a list by index' }, example: '=CHOOSE(2, "一", "二", "三")', result: '返回"二"', tips: { zh: ['索引从 1 开始', '适合固定分支的简单场景'], en: ['Index starts at 1', 'For simple fixed-branch cases'] }, difficulty: 1 },
  { id: 'rows', name: { zh: 'ROWS 行数', en: 'ROWS' }, category: 'lookup', syntax: 'ROWS(数组)', desc: { zh: '返回数组的行数', en: 'Return the number of rows in an array' }, example: '=ROWS(A1:A10)', result: '返回 10', tips: { zh: ['常配合 OFFSET/INDIRECT 实现动态区域'], en: ['Often paired with OFFSET/INDIRECT for dynamic ranges'] }, difficulty: 1 },
  { id: 'columns', name: { zh: 'COLUMNS 列数', en: 'COLUMNS' }, category: 'lookup', syntax: 'COLUMNS(数组)', desc: { zh: '返回数组的列数', en: 'Return the number of columns in an array' }, example: '=COLUMNS(A1:D1)', result: '返回 4', tips: { zh: ['同 ROWS,常用于动态范围'], en: ['Like ROWS, used in dynamic ranges'] }, difficulty: 1 },

  // ═══════ 数学类(13 个)═══════
  { id: 'sum', name: { zh: 'SUM 求和', en: 'SUM' }, category: 'math', syntax: 'SUM(数字1, [数字2], ...)', desc: { zh: '求一组数字的总和', en: 'Sum a set of numbers' }, example: '=SUM(A1:A10)', result: '返回 A1 到 A10 的总和', tips: { zh: ['最常用函数', 'SUMIF / SUMIFS 可条件求和', '可一次传入多个区域', '会自动忽略文本和空值'], en: ['Most used function', 'SUMIF/SUMIFS for conditional sum', 'Accepts multiple ranges', 'Ignores text and blanks'] }, difficulty: 1 },
  { id: 'sumif', name: { zh: 'SUMIF 条件求和', en: 'SUMIF' }, category: 'math', syntax: 'SUMIF(条件区域, 条件, [求和区域])', desc: { zh: '按条件对区域求和', en: 'Sum cells that meet a condition' }, example: '=SUMIF(A2:A100, "已付款", B2:B100)', result: '求 A 列等于"已付款"对应的 B 列总和', tips: { zh: ['条件可以用 >, <, =, <>', '文本条件加双引号', '数字条件直接写'], en: ['Use >, <, =, <> for conditions', 'Quote text conditions', 'No quotes for numbers'] }, difficulty: 2 },
  { id: 'sumifs', name: { zh: 'SUMIFS 多条件求和', en: 'SUMIFS' }, category: 'math', syntax: 'SUMIFS(求和区域, 条件区域1, 条件1, [条件区域2, 条件2], ...)', desc: { zh: '按多个条件求和', en: 'Sum cells that meet multiple conditions' }, example: '=SUMIFS(D:D, A:A, "华东", B:B, ">2024-01-01")', result: '华东地区 2024 年之后的销售额总和', tips: { zh: ['顺序与 SUMIF 相反:求和区域在前', '条件是 AND 关系', '可叠加 127 个条件'], en: ['Reverse order: sum_range first', 'Conditions are AND-ed', 'Up to 127 conditions'] }, difficulty: 2 },
  { id: 'sumproduct', name: { zh: 'SUMPRODUCT 乘积求和', en: 'SUMPRODUCT' }, category: 'math', syntax: 'SUMPRODUCT(数组1, [数组2], ...)', desc: { zh: '对应元素相乘后求和,功能强大', en: 'Multiply corresponding elements and sum — powerful' }, example: '=SUMPRODUCT(A2:A10, B2:B10)', result: 'A、B 列对应行相乘后求和(销售总额)', tips: { zh: ['可实现多条件计数/求和,无需数组公式', '替代部分 SUMIFS 场景', '大数据量时性能更好'], en: ['Multi-condition counting/summing without array formulas', 'Replaces some SUMIFS use cases', 'Better performance on large data'] }, difficulty: 3 },
  { id: 'round', name: { zh: 'ROUND 四舍五入', en: 'ROUND' }, category: 'math', syntax: 'ROUND(数字, 位数)', desc: { zh: '四舍五入到指定位数', en: 'Round to a specified number of digits' }, example: '=ROUND(3.14159, 2)', result: '返回 3.14', tips: { zh: ['位数 0 = 整数,负数 = 十位/百位', 'MROUND 可按指定倍数舍入'], en: ['0 = integer, negative = tens/hundreds', 'MROUND rounds to nearest multiple'] }, difficulty: 1 },
  { id: 'roundup', name: { zh: 'ROUNDUP 向上取整', en: 'ROUNDUP' }, category: 'math', syntax: 'ROUNDUP(数字, 位数)', desc: { zh: '向上(远离 0)舍入', en: 'Round up (away from zero)' }, example: '=ROUNDUP(3.14, 0)', result: '返回 4', tips: { zh: ['ROUNDDOWN 向下', 'INT 取整(向负无穷)', 'TRUNC 直接截断'], en: ['ROUNDDOWN for down', 'INT for negative infinity', 'TRUNC to truncate'] }, difficulty: 1 },
  { id: 'mod', name: { zh: 'MOD 取余', en: 'MOD' }, category: 'math', syntax: 'MOD(数字, 除数)', desc: { zh: '返回两数相除的余数', en: 'Return the remainder of division' }, example: '=MOD(10, 3)', result: '返回 1', tips: { zh: ['判断奇偶: =MOD(A1, 2)=0', '提取身份证生日: =MID(A1,7,8)'], en: ['Test even/odd: =MOD(A1, 2)=0', 'Extract birthday from ID: =MID(A1,7,8)'] }, difficulty: 1 },
  { id: 'int', name: { zh: 'INT 取整', en: 'INT' }, category: 'math', syntax: 'INT(数字)', desc: { zh: '向下取整到最接近的整数', en: 'Round down to nearest integer' }, example: '=INT(3.9)', result: '返回 3', tips: { zh: ['负数会向负方向取整: =INT(-3.1) = -4', '取整用 ROUNDDOWN 或 TRUNC 更直观'], en: ['Negatives round toward negative: =INT(-3.1) = -4', 'Use ROUNDDOWN or TRUNC for clarity'] }, difficulty: 1 },
  { id: 'abs', name: { zh: 'ABS 绝对值', en: 'ABS' }, category: 'math', syntax: 'ABS(数字)', desc: { zh: '返回数字的绝对值', en: 'Return the absolute value' }, example: '=ABS(-5)', result: '返回 5', tips: { zh: ['处理负数运算时常用'], en: ['Common when working with negative numbers'] }, difficulty: 1 },
  { id: 'power', name: { zh: 'POWER 幂运算', en: 'POWER' }, category: 'math', syntax: 'POWER(底数, 指数)', desc: { zh: '返回底数的指数次幂', en: 'Return base raised to exponent' }, example: '=POWER(2, 10)', result: '返回 1024', tips: { zh: ['也可写成 2^10', 'POWER 不支持负指数(用 1/POWER)'], en: ['Same as 2^10', 'POWER doesn\'t accept negative exponents (use 1/POWER)'] }, difficulty: 1 },
  { id: 'sqrt', name: { zh: 'SQRT 平方根', en: 'SQRT' }, category: 'math', syntax: 'SQRT(数字)', desc: { zh: '返回正平方根', en: 'Return positive square root' }, example: '=SQRT(16)', result: '返回 4', tips: { zh: ['负数返回 #NUM!', '开任意次方用 ^(1/n)'], en: ['Negative returns #NUM!', 'Use ^(1/n) for nth root'] }, difficulty: 1 },
  { id: 'rand', name: { zh: 'RAND 随机数', en: 'RAND' }, category: 'math', syntax: 'RAND()', desc: { zh: '返回 0 到 1 之间的随机小数', en: 'Return random number between 0 and 1' }, example: '=RAND()*100', result: '返回 0-100 之间的随机数', tips: { zh: ['每次工作表重算都更新', 'RANDBETWEEN(a,b) = a 到 b 之间的随机整数', '要固定值: 复制 → 粘贴数值'], en: ['Updates on every recalc', 'RANDBETWEEN(a,b) for random int', 'Copy & paste value to freeze'] }, difficulty: 1 },
  { id: 'rank', name: { zh: 'RANK 排名', en: 'RANK' }, category: 'math', syntax: 'RANK(数字, 区域, [顺序])', desc: { zh: '返回数字在区域中的排名', en: 'Return the rank of a number' }, example: '=RANK(A1, A$1:A$10, 0)', result: 'A1 在 10 个数中的降序排名', tips: { zh: ['0=降序(大=高),1=升序(小=高)', 'RANK.EQ 是新版本(同分同名次)', 'RANK.AVG 同分取平均名次'], en: ['0=desc (largest=1), 1=asc (smallest=1)', 'RANK.EQ is modern', 'RANK.AVG averages tied ranks'] }, difficulty: 2 },

  // ═══════ 文本类(15 个)═══════
  { id: 'concat', name: { zh: 'CONCAT 合并文本', en: 'CONCAT' }, category: 'text', syntax: 'CONCAT(文本1, [文本2], ...)', desc: { zh: '连接多个文本为一个字符串', en: 'Join text values into one string' }, example: '=CONCAT(A2, " - ", B2)', result: '返回 "产品名 - 类别"', tips: { zh: ['CONCATENATE 已过时,推荐用 CONCAT', 'TEXTJOIN 可以加分隔符', '也可直接用 & 连接'], en: ['CONCATENATE is deprecated, use CONCAT', 'TEXTJOIN adds a separator', 'Or use & operator'] }, difficulty: 1 },
  { id: 'textjoin', name: { zh: 'TEXTJOIN 带分隔符合并', en: 'TEXTJOIN' }, category: 'text', syntax: 'TEXTJOIN(分隔符, 忽略空, 文本1, [文本2], ...)', desc: { zh: '用分隔符连接文本,自动忽略空值', en: 'Join text with separator, optionally ignore empties' }, example: '=TEXTJOIN(", ", TRUE, A1:A10)', result: '把 A1:A10 用逗号+空格连成一行', tips: { zh: ['第二参数 TRUE = 跳过空单元格', '比 CONCAT + IF 组合方便', '常用于多条件查找结果合并'], en: ['2nd arg TRUE = skip empties', 'Better than CONCAT + IF combo', 'Common for combining multi-match results'] }, difficulty: 2 },
  { id: 'left', name: { zh: 'LEFT 左侧取字符', en: 'LEFT' }, category: 'text', syntax: 'LEFT(文本, [字符数])', desc: { zh: '从文本开头取指定数量字符', en: 'Return characters from the start' }, example: '=LEFT(A1, 3)', result: '返回 A1 的前 3 个字符', tips: { zh: ['不指定字符数默认 1', 'RIGHT 右侧取字符', 'MID 中间取字符'], en: ['Defaults to 1 char if not specified', 'RIGHT for end', 'MID for middle'] }, difficulty: 1 },
  { id: 'right', name: { zh: 'RIGHT 右侧取字符', en: 'RIGHT' }, category: 'text', syntax: 'RIGHT(文本, [字符数])', desc: { zh: '从文本末尾取指定数量字符', en: 'Return characters from the end' }, example: '=RIGHT(A1, 4)', result: '返回 A1 的后 4 个字符', tips: { zh: ['提取文件后缀: =RIGHT(A1, 3)'], en: ['Extract file extension: =RIGHT(A1, 3)'] }, difficulty: 1 },
  { id: 'mid', name: { zh: 'MID 中间取字符', en: 'MID' }, category: 'text', syntax: 'MID(文本, 起始位置, 字符数)', desc: { zh: '从中间位置取指定数量字符', en: 'Return characters from a position' }, example: '=MID(A1, 3, 5)', result: '从第 3 个字符开始,取 5 个', tips: { zh: ['起始位置从 1 开始', '身份证生日: =MID(A1,7,8)'], en: ['Start position is 1-based', 'ID birthday: =MID(A1,7,8)'] }, difficulty: 1 },
  { id: 'len', name: { zh: 'LEN 文本长度', en: 'LEN' }, category: 'text', syntax: 'LEN(文本)', desc: { zh: '返回文本字符数(中文每个字算 1)', en: 'Return number of characters' }, example: '=LEN("hello")', result: '返回 5', tips: { zh: ['LENB 字节数(中文每个 2 字节)', '常配合 LEFT/RIGHT 截取'], en: ['LENB returns byte count', 'Often paired with LEFT/RIGHT'] }, difficulty: 1 },
  { id: 'upper', name: { zh: 'UPPER 大写', en: 'UPPER' }, category: 'text', syntax: 'UPPER(文本)', desc: { zh: '把文本转为大写', en: 'Convert to uppercase' }, example: '=UPPER("hello")', result: '返回 "HELLO"', tips: { zh: ['LOWER 小写,PROPER 首字母大写'], en: ['LOWER for lowercase, PROPER for title case'] }, difficulty: 1 },
  { id: 'trim', name: { zh: 'TRIM 清理空格', en: 'TRIM' }, category: 'text', syntax: 'TRIM(文本)', desc: { zh: '删除首尾空格,单词间保留一个空格', en: 'Remove extra spaces (keeps single spaces between words)' }, example: '=TRIM("  hello   world  ")', result: '返回 "hello world"', tips: { zh: ['CLEAN 删除非打印字符', 'SUBSTITUTE 替换指定字符'], en: ['CLEAN removes non-printable', 'SUBSTITUTE replaces specific chars'] }, difficulty: 1 },
  { id: 'substitute', name: { zh: 'SUBSTITUTE 替换', en: 'SUBSTITUTE' }, category: 'text', syntax: 'SUBSTITUTE(文本, 旧文本, 新文本, [第几次出现])', desc: { zh: '把文本中的旧字符串替换为新字符串', en: 'Replace old text with new text' }, example: '=SUBSTITUTE(A1, "-", "/")', result: '把 A1 中所有"-"替换为"/"', tips: { zh: ['第 4 参数 = 只替换第 N 次出现', 'REPLACE 按位置替换,SUBSTITUTE 按内容'], en: ['4th arg = replace only the Nth occurrence', 'REPLACE works by position, SUBSTITUTE by content'] }, difficulty: 2 },
  { id: 'replace', name: { zh: 'REPLACE 位置替换', en: 'REPLACE' }, category: 'text', syntax: 'REPLACE(旧文本, 起始位置, 字符数, 新文本)', desc: { zh: '从指定位置开始替换指定长度字符', en: 'Replace characters from a position' }, example: '=REPLACE(A1, 4, 3, "***")', result: '从第 4 位开始替换 3 个字符为"***"', tips: { zh: ['适合固定格式文本'], en: ['For fixed-format text'] }, difficulty: 2 },
  { id: 'find', name: { zh: 'FIND 区分大小写查找', en: 'FIND' }, category: 'text', syntax: 'FIND(查找文本, 源文本, [起始位置])', desc: { zh: '返回查找文本在源文本中的位置(区分大小写)', en: 'Find substring (case-sensitive)' }, example: '=FIND("@", A1)', result: '返回 @ 在 A1 中的位置', tips: { zh: ['SEARCH 是不区分大小写的版本', '找不到返回 #VALUE!', '配合 MID/LEFT/RIGHT 截取'], en: ['SEARCH is case-insensitive version', 'Returns #VALUE! if not found', 'Pair with MID/LEFT/RIGHT'] }, difficulty: 2 },
  { id: 'search', name: { zh: 'SEARCH 不区分大小写查找', en: 'SEARCH' }, category: 'text', syntax: 'SEARCH(查找文本, 源文本, [起始位置])', desc: { zh: 'FIND 的不区分大小写版本,支持通配符', en: 'Like FIND but case-insensitive, supports wildcards' }, example: '=SEARCH("a*", A1)', result: '查找以 a 开头的字符串', tips: { zh: ['* 匹配任意字符,? 匹配单个字符'], en: ['* matches any, ? matches one'] }, difficulty: 2 },
  { id: 'text', name: { zh: 'TEXT 格式化', en: 'TEXT' }, category: 'text', syntax: 'TEXT(值, 格式代码)', desc: { zh: '把数字按指定格式转为文本', en: 'Format a value as text' }, example: '=TEXT(TODAY(), "yyyy-mm-dd")', result: '返回 "2026-06-02"', tips: { zh: ['常用格式:"0.00" 保留 2 位小数,"#,##0" 千分位,"0%" 百分比', '与 & 拼接时很常用', '"yyyy年mm月dd日" 自定义显示'], en: ['"0.00" = 2 decimals, "#,##0" = thousands, "0%" = percent', 'Common with & concat', '"yyyy-mm-dd" for date display'] }, difficulty: 2 },
  { id: 'value', name: { zh: 'VALUE 转数字', en: 'VALUE' }, category: 'text', syntax: 'VALUE(文本)', desc: { zh: '把文本数字转为真正的数字', en: 'Convert text number to actual number' }, example: '=VALUE("123")', result: '返回 123(数字)', tips: { zh: ['-- 也能强制转换: =--"123"', '+0 也可以: ="123"+0'], en: ['-- also coerces: =--"123"', '+0 also works: ="123"+0'] }, difficulty: 1 },
  { id: 'rept', name: { zh: 'REPT 重复', en: 'REPT' }, category: 'text', syntax: 'REPT(文本, 次数)', desc: { zh: '把文本重复 N 次', en: 'Repeat text N times' }, example: '=REPT("*", 5)', result: '返回 "*****"', tips: { zh: ['常用于单元格内做"条形图": =REPT("█", A1/10)'], en: ['In-cell bar chart: =REPT("█", A1/10)'] }, difficulty: 1 },

  // ═══════ 日期时间类(12 个)═══════
  { id: 'today', name: { zh: 'TODAY 今天', en: 'TODAY' }, category: 'date', syntax: 'TODAY()', desc: { zh: '返回当前日期', en: 'Return current date' }, example: '=TODAY()', result: '返回今天日期,如 2026-06-02', tips: { zh: ['无参数,工作簿打开/重算时更新', 'NOW() 还包含时间', '不变化的快照: 复制 → 粘贴数值'], en: ['No args, updates on recalc', 'NOW() includes time', 'Copy & paste value to freeze'] }, difficulty: 1 },
  { id: 'now', name: { zh: 'NOW 当前时间', en: 'NOW' }, category: 'date', syntax: 'NOW()', desc: { zh: '返回当前日期和时间', en: 'Return current date and time' }, example: '=NOW()', result: '返回 2026-06-02 14:35:22', tips: { zh: ['每分钟更新', '需要固定值用 Ctrl+; 输入日期,Ctrl+Shift+; 输入时间'], en: ['Updates every minute', 'Use Ctrl+; for date, Ctrl+Shift+; for time'] }, difficulty: 1 },
  { id: 'year', name: { zh: 'YEAR 年', en: 'YEAR' }, category: 'date', syntax: 'YEAR(日期)', desc: { zh: '返回日期的年份', en: 'Return the year' }, example: '=YEAR(TODAY())', result: '返回 2026', tips: { zh: ['MONTH 月,DAY 日,HOUR 时,MINUTE 分,SECOND 秒'], en: ['MONTH, DAY, HOUR, MINUTE, SECOND also available'] }, difficulty: 1 },
  { id: 'month', name: { zh: 'MONTH 月', en: 'MONTH' }, category: 'date', syntax: 'MONTH(日期)', desc: { zh: '返回日期的月份(1-12)', en: 'Return the month (1-12)' }, example: '=MONTH(TODAY())', result: '返回 6', tips: { zh: ['配合 & 拼接日期字符串: =YEAR(A1)&"-"&MONTH(A1)'], en: ['Format date: =YEAR(A1)&"-"&MONTH(A1)'] }, difficulty: 1 },
  { id: 'day', name: { zh: 'DAY 日', en: 'DAY' }, category: 'date', syntax: 'DAY(日期)', desc: { zh: '返回日期的天数(1-31)', en: 'Return the day of month (1-31)' }, example: '=DAY(TODAY())', result: '返回 2', tips: { zh: ['WEEKDAY 返回星期几(1=日,2=一...)', 'WEEKNUM 返回第几周'], en: ['WEEKDAY for day of week', 'WEEKNUM for week number'] }, difficulty: 1 },
  { id: 'datedif', name: { zh: 'DATEDIF 日期差', en: 'DATEDIF' }, category: 'date', syntax: 'DATEDIF(开始日期, 结束日期, 单位)', desc: { zh: '计算两个日期的差值', en: 'Calculate difference between two dates' }, example: '=DATEDIF(A1, B1, "y")', result: '返回 A1 到 B1 的整年数', tips: { zh: ['单位:"y"年,"m"月,"d"日,"yd"忽略年取日差,"ym"忽略年取月差,"md"忽略月取日差', '常用于计算年龄、工龄', '开始日期必须小于结束日期'], en: ['Units: "y" years, "m" months, "d" days, "yd"/"ym"/"md" for date-only diffs', 'Common for age/tenure calculation', 'Start must be earlier than end'] }, difficulty: 3 },
  { id: 'date', name: { zh: 'DATE 构造日期', en: 'DATE' }, category: 'date', syntax: 'DATE(年, 月, 日)', desc: { zh: '由年、月、日构造日期值', en: 'Construct a date from year/month/day' }, example: '=DATE(2026, 6, 2)', result: '返回 2026/6/2', tips: { zh: ['结果是与 TODAY() 同类型的日期数字', '月超过 12 会自动跨年: =DATE(2026, 14, 1) = 2027/2/1', '提取日期: =DATE(YEAR(A1), MONTH(A1), DAY(A1)+1) 加一天'], en: ['Result is a date serial', 'Month > 12 rolls over to next year', 'Add day: =DATE(YEAR(A1), MONTH(A1), DAY(A1)+1)'] }, difficulty: 2 },
  { id: 'edate', name: { zh: 'EDATE 推算日期', en: 'EDATE' }, category: 'date', syntax: 'EDATE(开始日期, 月数)', desc: { zh: '返回开始日期之后/之前 N 个月的日期', en: 'Return date N months from start' }, example: '=EDATE(TODAY(), 3)', result: '3 个月后的今天', tips: { zh: ['负数表示过去: =EDATE(TODAY(), -1) = 上个月今天', '合同到期日、保修期常用', 'EOMONTH 返回月末日期'], en: ['Negative for past', 'Common for contract expiration', 'EOMONTH for end of month'] }, difficulty: 2 },
  { id: 'eomonth', name: { zh: 'EOMONTH 月末', en: 'EOMONTH' }, category: 'date', syntax: 'EOMONTH(开始日期, 月数)', desc: { zh: '返回指定月份最后一天的日期', en: 'Return last day of month N months from start' }, example: '=EOMONTH(TODAY(), 0)', result: '本月最后一天', tips: { zh: ['常用 0 表示本月,-1 上月,1 下月', '账期结算、月末报表'], en: ['0=this month, -1=last, 1=next', 'Common for billing/period close'] }, difficulty: 2 },
  { id: 'networkdays', name: { zh: 'NETWORKDAYS 工作日', en: 'NETWORKDAYS' }, category: 'date', syntax: 'NETWORKDAYS(开始日期, 结束日期, [假期])', desc: { zh: '返回两个日期之间的工作日数(扣除周末)', en: 'Count working days between two dates (excluding weekends)' }, example: '=NETWORKDAYS(A1, B1)', result: 'A1 到 B1 的工作日数(默认周六日休)', tips: { zh: ['第三参数可以指定假期范围', 'NETWORKDAYS.INTL 可自定义周末', '算工期、薪资很常用'], en: ['3rd arg for holiday list', 'NETWORKDAYS.INTL for custom weekends', 'Common for project duration'] }, difficulty: 2 },
  { id: 'workday', name: { zh: 'WORKDAY 推算工作日', en: 'WORKDAY' }, category: 'date', syntax: 'WORKDAY(开始日期, 天数, [假期])', desc: { zh: '返回开始日期后 N 个工作日的日期', en: 'Return date N working days from start' }, example: '=WORKDAY(TODAY(), 10)', result: '10 个工作日后的日期', tips: { zh: ['常用于排期: 15 个工作日后交付', 'WORKDAY.INTL 自定义周末'], en: ['Common for "deliver in 10 business days"', 'WORKDAY.INTL for custom weekends'] }, difficulty: 2 },
  { id: 'weekday', name: { zh: 'WEEKDAY 星期', en: 'WEEKDAY' }, category: 'date', syntax: 'WEEKDAY(日期, [返回类型])', desc: { zh: '返回日期是星期几', en: 'Return the day of week' }, example: '=WEEKDAY(TODAY(), 2)', result: '返回 1-7(周一=1)', tips: { zh: ['类型 1=周日=1(默认),2=周一=1,3=周一=0', '常配合 CHOOSE 显示"周一"等中文'], en: ['Type 1: Sun=1 (default), 2: Mon=1, 3: Mon=0', 'Pair with CHOOSE for "Monday" labels'] }, difficulty: 2 },

  // ═══════ 逻辑类(8 个)═══════
  { id: 'if', name: { zh: 'IF 条件判断', en: 'IF' }, category: 'logic', syntax: 'IF(条件, 真值, [假值])', desc: { zh: '按条件返回不同值', en: 'Return different values based on a condition' }, example: '=IF(A1>=60, "及格", "不及格")', result: 'A1>=60 返回"及格",否则"不及格"', tips: { zh: ['最多嵌套 64 层', '复杂条件用 IFS(Excel 2019+)', '多返回值用 SWITCH(Excel 2019+)'], en: ['Up to 64 nested IFs', 'Use IFS for many branches (2019+)', 'Use SWITCH for many values (2019+)'] }, difficulty: 1 },
  { id: 'ifs', name: { zh: 'IFS 多条件', en: 'IFS' }, category: 'logic', syntax: 'IFS(条件1, 值1, 条件2, 值2, ...)', desc: { zh: '替代嵌套 IF,更清晰', en: 'Replace nested IFs, cleaner' }, example: '=IFS(A1>=90,"A", A1>=80,"B", A1>=70,"C", TRUE,"D")', result: '按分数返回等级', tips: { zh: ['Excel 2019+ / 365', '最后加 TRUE 兜底,否则不匹配返回 #N/A', '与 IF 区别: 不会先求值所有分支'], en: ['Excel 2019+ / 365', 'Add TRUE as final fallback to avoid #N/A', 'Lazy evaluation unlike nested IF'] }, difficulty: 2 },
  { id: 'and', name: { zh: 'AND 与', en: 'AND' }, category: 'logic', syntax: 'AND(条件1, [条件2], ...)', desc: { zh: '所有条件为 TRUE 才返回 TRUE', en: 'Return TRUE only if all conditions are TRUE' }, example: '=AND(A1>0, A1<100)', result: 'A1 在 0-100 之间返回 TRUE', tips: { zh: ['OR 任一为真就返回 TRUE', 'NOT 取反'], en: ['OR for any true', 'NOT to invert'] }, difficulty: 1 },
  { id: 'or', name: { zh: 'OR 或', en: 'OR' }, category: 'logic', syntax: 'OR(条件1, [条件2], ...)', desc: { zh: '任一条件为 TRUE 就返回 TRUE', en: 'Return TRUE if any condition is TRUE' }, example: '=OR(A1="男", A1="女")', result: 'A1 是男或女返回 TRUE', tips: { zh: ['与 AND 配合可实现复杂条件'], en: ['Combine with AND for complex conditions'] }, difficulty: 1 },
  { id: 'not', name: { zh: 'NOT 非', en: 'NOT' }, category: 'logic', syntax: 'NOT(条件)', desc: { zh: '取反', en: 'Invert a logical value' }, example: '=NOT(A1>10)', result: 'A1 不大于 10 返回 TRUE', tips: { zh: ['双 NOT 等于数字转布尔: =NOT(NOT(5)) = TRUE', '配合 IF: =IF(NOT(A1=""), "已填", "空")'], en: ['Double NOT coerces: =NOT(NOT(5)) = TRUE', 'Pair with IF for empty checks'] }, difficulty: 1 },
  { id: 'iferror', name: { zh: 'IFERROR 容错', en: 'IFERROR' }, category: 'logic', syntax: 'IFERROR(表达式, 错误时返回值)', desc: { zh: '公式出错时返回指定值', en: 'Return a value if formula errors' }, example: '=IFERROR(A1/B1, 0)', result: 'B1=0 时返回 0,不显示 #DIV/0!', tips: { zh: ['常用于 VLOOKUP 容错', '会捕获所有错误,可能掩盖真问题', 'IFNA 只捕获 #N/A,更精确'], en: ['Common for VLOOKUP fallback', 'Catches all errors — may mask issues', 'IFNA is more precise (only #N/A)'] }, difficulty: 2 },
  { id: 'switch', name: { zh: 'SWITCH 匹配', en: 'SWITCH' }, category: 'logic', syntax: 'SWITCH(表达式, 值1, 结果1, 值2, 结果2, ..., [默认值])', desc: { zh: '按表达式值匹配返回对应结果', en: 'Match expression against values and return result' }, example: '=SWITCH(A1, 1, "一", 2, "二", 3, "三", "其他")', result: 'A1=1 返回"一",依此类推', tips: { zh: ['Excel 2019+ / 365', '比 IF+OR 嵌套更清晰', '默认值可选,无匹配返回 #N/A'], en: ['Excel 2019+ / 365', 'Cleaner than nested IF+OR', 'Default is optional, else #N/A'] }, difficulty: 2 },
  { id: 'isblank', name: { zh: 'ISBLANK 是否为空', en: 'ISBLANK' }, category: 'logic', syntax: 'ISBLANK(单元格)', desc: { zh: '判断单元格是否为空', en: 'Check if a cell is blank' }, example: '=ISBLANK(A1)', result: 'A1 空返回 TRUE,否则 FALSE', tips: { zh: ['空字符串""不算空,要用 A1=""', 'ISNUMBER / ISTEXT / ISERROR 同类'], en: ['Empty string "" is not blank; use A1=""', 'ISNUMBER, ISTEXT, ISERROR same family'] }, difficulty: 1 },

  // ═══════ 统计类(7 个)═══════
  { id: 'count', name: { zh: 'COUNT 计数', en: 'COUNT' }, category: 'stats', syntax: 'COUNT(值1, [值2], ...)', desc: { zh: '统计数字单元格的数量', en: 'Count cells that contain numbers' }, example: '=COUNT(A1:A100)', result: 'A 列中数字的个数', tips: { zh: ['COUNTA 计非空(数字+文本)', 'COUNTBLANK 计空白', 'COUNTIF 条件计数'], en: ['COUNTA counts non-empty', 'COUNTBLANK counts blanks', 'COUNTIF conditional count'] }, difficulty: 1 },
  { id: 'countif', name: { zh: 'COUNTIF 条件计数', en: 'COUNTIF' }, category: 'stats', syntax: 'COUNTIF(区域, 条件)', desc: { zh: '按条件计数', en: 'Count cells meeting a condition' }, example: '=COUNTIF(A1:A100, "已付款")', result: '统计"已付款"的个数', tips: { zh: ['条件可用通配符:"张*" 以张开头的', '">60" 数字大于 60', 'COUNTIFS 多条件'], en: ['Wildcards: "张*"', '">60" for numbers', 'COUNTIFS for multiple'] }, difficulty: 2 },
  { id: 'countifs', name: { zh: 'COUNTIFS 多条件计数', en: 'COUNTIFS' }, category: 'stats', syntax: 'COUNTIFS(区域1, 条件1, [区域2, 条件2], ...)', desc: { zh: '按多个条件计数', en: 'Count cells meeting multiple conditions' }, example: '=COUNTIFS(A:A, "男", B:B, ">20")', result: '20 岁以上的男性人数', tips: { zh: ['多个条件是 AND 关系', '可计数 127 个条件'], en: ['Conditions are AND-ed', 'Up to 127 conditions'] }, difficulty: 2 },
  { id: 'average', name: { zh: 'AVERAGE 平均值', en: 'AVERAGE' }, category: 'stats', syntax: 'AVERAGE(数字1, [数字2], ...)', desc: { zh: '算术平均', en: 'Arithmetic mean' }, example: '=AVERAGE(A1:A10)', result: 'A1-A10 的平均值', tips: { zh: ['AVERAGEIF / AVERAGEIFS 条件平均', 'MEDIAN 中位数,MODE 众数', '忽略文本和空值'], en: ['AVERAGEIF/AVERAGEIFS conditional mean', 'MEDIAN, MODE for stats', 'Ignores text and blanks'] }, difficulty: 1 },
  { id: 'max', name: { zh: 'MAX 最大值', en: 'MAX' }, category: 'stats', syntax: 'MAX(数字1, [数字2], ...)', desc: { zh: '返回最大值', en: 'Return the largest value' }, example: '=MAX(A1:A100)', result: 'A 列最大数', tips: { zh: ['MIN 最小值', 'LARGE(arr, n) 第 n 大', 'SMALL(arr, n) 第 n 小'], en: ['MIN for smallest', 'LARGE(arr, n) for nth largest', 'SMALL(arr, n) for nth smallest'] }, difficulty: 1 },
  { id: 'stdev', name: { zh: 'STDEV 标准差', en: 'STDEV' }, category: 'stats', syntax: 'STDEV(数字1, [数字2], ...)', desc: { zh: '样本标准差(分母 n-1)', en: 'Sample standard deviation (n-1 denominator)' }, example: '=STDEV(A1:A100)', result: 'A 列样本标准差', tips: { zh: ['STDEVP 总体标准差(分母 n)', 'VAR 方差,STDEV = √VAR', '正态分布约 68% 数据在 ±1σ 内'], en: ['STDEVP for population (n)', 'VAR = variance, STDEV = √VAR', '~68% within ±1σ for normal distribution'] }, difficulty: 3 },
  { id: 'quartile', name: { zh: 'QUARTILE 四分位', en: 'QUARTILE' }, category: 'stats', syntax: 'QUARTILE(数组, 0|1|2|3|4)', desc: { zh: '返回四分位数', en: 'Return quartile values' }, example: '=QUARTILE(A1:A100, 1)', result: '下四分位数(Q1)', tips: { zh: ['0=最小,1=Q1,2=中位数,3=Q3,4=最大', 'QUARTILE.INC 与 QUARTILE.EXC 行为略有差异', '箱线图常用'], en: ['0=min, 1=Q1, 2=median, 3=Q3, 4=max', 'INC vs EXC differ slightly', 'Common for box plots'] }, difficulty: 3 },
];

const CATEGORIES: { key: Formula['category'] | 'all'; label: { zh: string; en: string }; icon: any }[] = [
  { key: 'all', label: { zh: '全部', en: 'All' }, icon: BookOpen },
  { key: 'lookup', label: { zh: '查找引用', en: 'Lookup' }, icon: Search },
  { key: 'math', label: { zh: '数学', en: 'Math' }, icon: Calculator },
  { key: 'text', label: { zh: '文本', en: 'Text' }, icon: Lightbulb },
  { key: 'date', label: { zh: '日期时间', en: 'Date' }, icon: Calculator },
  { key: 'logic', label: { zh: '逻辑', en: 'Logic' }, icon: Check },
  { key: 'stats', label: { zh: '统计', en: 'Stats' }, icon: Calculator },
];

const DIFFICULTY_LABEL = { 1: { zh: '入门', en: 'Easy', color: '#10b981' }, 2: { zh: '进阶', en: 'Mid', color: 'var(--color-accent)' }, 3: { zh: '高级', en: 'Advanced', color: '#f43f5e' } };

export function ExcelFormulaTool() {
  const { lang } = useI18n();
  const T = {
    title: lang === 'en' ? 'Excel Formulas' : 'Excel 公式',
    sub: lang === 'en' ? `${FORMULAS.length} real formulas with examples` : `${FORMULAS.length} 个真实公式 · 含示例和说明`,
    search: lang === 'en' ? 'Search by name or desc...' : '搜索公式名/描述...',
    tip: lang === 'en' ? 'Tip' : '提示',
    example: lang === 'en' ? 'Example' : '示例',
    result: lang === 'en' ? 'Returns' : '返回',
    difficulty: lang === 'en' ? 'Level' : '难度',
    copy: lang === 'en' ? 'Copy' : '复制',
    copied: lang === 'en' ? 'Copied' : '已复制',
    empty: lang === 'en' ? 'No matching formula' : '没找到匹配的公式',
    noResult: lang === 'en' ? 'Select a formula to see details' : '选个公式看详情',
  };

  const [cat, setCat] = useState<Formula['category'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Formula | null>(FORMULAS[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return FORMULAS.filter((f) => {
      if (cat !== 'all' && f.category !== cat) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return f.name.zh.toLowerCase().includes(q) ||
        f.name.en.toLowerCase().includes(q) ||
        f.desc.zh.toLowerCase().includes(q) ||
        f.desc.en.toLowerCase().includes(q) ||
        f.syntax.toLowerCase().includes(q);
    });
  }, [cat, search]);

  const copy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <div className="grid grid-cols-[360px_1fr] h-full">
      {/* Left: list */}
      <div className="flex flex-col" style={{ borderRight: '1px solid var(--color-border)' }}>
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={T.search}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] outline-none"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className="h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
                style={{
                  background: cat === c.key ? 'var(--color-accent-glow)' : 'transparent',
                  color: cat === c.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  border: `1px solid ${cat === c.key ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}
              >
                <c.icon size={11} />
                {c.label[lang]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((f) => {
            const isActive = selected?.id === f.id;
            const diff = DIFFICULTY_LABEL[f.difficulty];
            return (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
                style={{
                  background: isActive ? 'var(--color-accent-glow)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--color-accent)' : 'transparent'}`,
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{f.name[lang]}</span>
                  <span className="text-[9px] px-1 rounded" style={{ background: diff.color, color: '#0a0a0c', fontWeight: 600 }}>
                    {'★'.repeat(f.difficulty)}
                  </span>
                </div>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{f.desc[lang]}</p>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-[12px] py-8" style={{ color: 'var(--color-text-muted)' }}>{T.empty}</p>
          )}
        </div>
      </div>

      {/* Right: detail */}
      <div className="overflow-y-auto p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Calculator size={32} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>{T.noResult}</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selected.name[lang]}</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: DIFFICULTY_LABEL[selected.difficulty].color, color: '#0a0a0c' }}>
                  {T.difficulty}: {DIFFICULTY_LABEL[selected.difficulty][lang]}
                </span>
              </div>
              <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>{selected.desc[lang]}</p>
            </div>

            {/* Syntax */}
            <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {lang === 'en' ? 'Syntax' : '语法'}
                </p>
                <button
                  onClick={() => copy(selected.syntax, selected.id + '-syn')}
                  className="text-[10px] flex items-center gap-1 px-2 py-1 rounded transition-colors"
                  style={{ background: copiedId === selected.id + '-syn' ? 'var(--color-accent-glow)' : 'var(--color-bg-main)', color: 'var(--color-text-secondary)' }}
                >
                  {copiedId === selected.id + '-syn' ? <><Check size={10} />{T.copied}</> : <><Copy size={10} />{T.copy}</>}
                </button>
              </div>
              <code className="block text-[13px] font-mono leading-relaxed px-3 py-2 rounded-md" style={{ background: 'var(--color-bg-main)', color: 'var(--color-accent)' }}>
                {selected.syntax}
              </code>
            </div>

            {/* Example */}
            <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{T.example}</p>
                <button
                  onClick={() => copy(selected.example, selected.id + '-ex')}
                  className="text-[10px] flex items-center gap-1 px-2 py-1 rounded transition-colors"
                  style={{ background: copiedId === selected.id + '-ex' ? 'var(--color-accent-glow)' : 'var(--color-bg-main)', color: 'var(--color-text-secondary)' }}
                >
                  {copiedId === selected.id + '-ex' ? <><Check size={10} />{T.copied}</> : <><Copy size={10} />{T.copy}</>}
                </button>
              </div>
              <code className="block text-[13px] font-mono px-3 py-2 rounded-md mb-3" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
                {selected.example}
              </code>
              <p className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{T.result}:</span> {selected.result}
              </p>
            </div>

            {/* Tips */}
            <div className="rounded-xl p-4" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-accent)' }}>
                💡 {T.tip}
              </p>
              <ul className="space-y-1.5">
                {selected.tips[lang].map((t, i) => (
                  <li key={i} className="text-[12px] flex gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-accent)' }}>·</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
