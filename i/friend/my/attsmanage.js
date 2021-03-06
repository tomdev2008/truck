/*
 *	空间 好友-跟随后台
 *  @author bobotieyang@sohu-inc.com
 */
;
(function($){

var app = 'friendsapp';

var PAGE_NAME = 'attsManage';

var GROUP_POP_CLASS = 'class-friends-app-group';

var GROUP_POP_MINWIDTH = 145;

var GROUP_LIMIT = 20;//可创建的分组

 
var NEW_GROUP_TIP_TEXT = '请输入新分组名称';

var project = {
	$this: null,
	options: {
		
	},
	isInited: false,
	groupPop: null,//分组浮层
	groupHash: {
		curgroup: 0,
		total: 0,
		groups:[],
		nogroup: 0
	},
	card: null,//名片
	init: function($this,options){
		var self = this;
		this.$this = $this;
		$.extend(this.options,options || {});
		
		if(!$[app].utils.isUndefined(this.options.curgroup)){
			this.groupHash.curgroup =  this.options.curgroup;
		}
		if(!$[app].utils.isUndefined(this.options.total)){
			this.groupHash.total =  this.options.total;
		}
		if(!$[app].utils.isUndefined(this.options.groups)){
			this.groupHash.groups =  this.options.groups;
			if(this.groupHash.groups.length >=GROUP_LIMIT){
				$this.find('.app-friends-addgroup').hide();
			}
		}
		if(!$[app].utils.isUndefined(this.options.nogroup)){
			this.groupHash.nogroup =  this.options.nogroup;
		}
		/*
		执行每次都需要重复绑定的事件
		如suggest初始化
		*/
		
		this.groupPop = null;//每次更新页面，分组弹框都需要清空

		var findTipText = '输入昵称或备注';
		var $form = $this.find('div.search form');
		var $nick = $form.find('input[name=nick]');
		$[app].pageviewSearch.init($form,{
			'target': $this,
			'onBeforeSubmit': function(){
				$nick.val($.trim($nick.val()));
				if($nick.val() == '' || $nick.val() == findTipText){
					$nick.val('').focus();
					return false;
				}
				return true;
			}
		});

		$nick
			.iPrompt({text: findTipText,css:{'color':'#999999'}})
			.ajaxSuggest({
				appendTo: '#friend-canvas',
				url: '/a/search/user/friend/sug.do?cb=?&_input_encode=UTF-8',
				dataType: 'jsonp',
				paramName: 'nick',
				extraParams: {
					'type':'friend'
				},
				funFormatResults: function(data){
					var ary,results = [];
					if(data.code == 1){
						if($.isArray(data.data.friends)){
							ary = data.data.friends;
							for(var i=0;i<ary.length;i+=1){
								results[results.length] = {
									data: ary[i].nick,
									value: ary[i].nick
								};
							}
						}
					}
					
					return results;
				},
				funFormatItem: function(value,data,lastValue){
					lastValue = $.trim(lastValue);
					value = $[app].utils.cutCjkString(value,26,'...',2);
					if(lastValue == ''){
						return value;
					}
					var reg = new RegExp('('+lastValue+')','ig');
					return value.replace(reg,'<strong>$1</strong>');
				},
				onItemSelect: function(data){
					$form.submit();
				}
			});
		
		
		this.getSentence();//回填一句话
		
		$(window).scrollTop(0);


		//右侧分组信息的鼠标滑动效果
		this.$this.find('div.app-right > div.follow-list li').not('.current').hover(function(){
			$(this).addClass('active');
		},function(){
			$(this).removeClass('active');
		});

		/*
		如果当前页面就是本页面，则执行静态绑定
		*/
		if($this.data('friends-page') && $this.data('friends-page') == PAGE_NAME){
			return $this;
		}
		
		/*
		下面是所有静态绑定的事件
		*/
		/*
		首先取消之前页面所有的静态绑定
		*/
		this.initCard();//初始化名片

		$this.unbind('.'+app).undelegate('.'+app);
		

		/*
		静态绑定click事件，处理取消跟随，设置备注
		*/
		$this
		.bind('click.'+app,function(event){

			var $target = $(event.target),$div,uid,userName,gid,_xpt_;
			
			//取消跟随
			if($target.closest('.app-friends-remove').length){
				$target = $target.closest('.app-friends-remove');
				$div = $target.closest('div[data-friends-xpt]');
				if($div.length){
					userName = $div.find('.user-name a:eq(0)').attr('title');
					_xpt_ = $div.attr('data-friends-xpt');
					$[app].unFollow(_xpt_,userName,
					function(data){
						//取消成功后删除该元素
						$div.slideUp('slow',function(){
							$div.remove();
							if(!$this.find('.friend-item-list > .friend-item').length){
								window.location.reload();
							}
						});
						self.updateCount({
							'groups': $div.attr('data-friends-groups') || ''
						});
						self.card.clearCache();
						$[app].removeRecommend(_xpt_,function(){});
					},
					event);
				};
			}
			//打招呼
			else if($target.closest('.app-friends-poke').length){
				$target = $target.closest('.app-friends-poke');
				$div = $target.closest('div[data-friends-xpt]');
				if($div.length){
					$[app].pokeMe($div.attr('data-friends-xpt'));
				};
			}
			//分组弹框
			else if($target.closest('.app-friends-mapping').length){
				$target = $target.closest('.app-friends-mapping');
				$div = $target.closest('div[data-friends-xpt]');
				if($div.length){
					self.showGroupPop($div,$target);
				};
			}
			//新建分组
			else if($target.closest('.app-friends-addgroup').length){
				$target = $target.closest('.app-friends-addgroup');
				self.toogleCreateGroup($target);
			}
			//添加备注
			else if($target.closest('.app-friends-remark-add').length){
				$target = $target.closest('.app-friends-remark-add');
				$div = $target.closest('div[data-friends-friendid]');
				self.setDesc($div,'');
			}
			//修改备注
			else if($target.closest('.app-friends-remark-edit').length){
				$target = $target.closest('.app-friends-remark-edit');
				$div = $target.closest('div[data-friends-friendid]');
				self.setDesc($div,$target.find('a').text());
			}
			//修改分组名称
			else if($target.closest('.app-friends-editgroup').length){
				self.updateGroupName();
			}
			//删除分组
			else if($target.closest('.app-friends-deletegroup').length){
				self.delGroup();
			}
			//增加推荐
			else if($target.closest('a.app-friends-add-recommend').length){
				$target = $target.closest('a.app-friends-add-recommend');
				$div = $target.closest('div[data-friends-xpt]');
				if($div.length){
					$[app].addRecommend($div.attr('data-friends-xpt'),function(){
						$target.attr('class','app-friends-remove-recommend').text('取消推荐');
					});
				};
			}
			//取消推荐
			else if($target.closest('a.app-friends-remove-recommend').length){
				$target = $target.closest('a.app-friends-remove-recommend');
				$div = $target.closest('div[data-friends-xpt]');
				if($div.length){
					userName = $div.find('.user-name a:eq(0)').attr('title');
					$.confirm({
						title: false,
						content: '<p style="line-height:150%">确定将"'+userName+'"移出特别推荐吗？<br />此操作将不会解除你们之间的跟随关系。</p>',
						onConfirm: function(){
							$[app].removeRecommend($div.attr('data-friends-xpt'),function(){
								$target.attr('class','app-friends-add-recommend').text('增加推荐');
							});
						}
					});
				};
			}
		})
		/*
		静态绑定mouseover事件  静态绑定mouseout事件
		*/
		.delegate('div.friend-item','mouseenter.' + app,function(){
			var $target = $(this);
			$target.addClass('active');
			$target.find('.follow-undo').show();
			$target.find('.app-friends-remark-add').css('visibility','visible');
		})
		.delegate('div.friend-item','mouseleave.' + app,function(){
			var $target = $(this);
			$target.removeClass('active');
			$target.find('.follow-undo').hide();
			$target.find('.app-friends-remark-add').css('visibility','hidden');
		});
		
		$this.data('friends-page',PAGE_NAME);
	},
	/*分组相关 函数*/
	showGroupPop: function($div,$target){
		var self = this;
		if(!this.groupPop){
			this.groupPop = this.initGroupPop();
		}
		var $ul = this.groupPop.find('ul');
		this.groupPop.find('div.creat-group-menu').hide();
		if(self.groupHash.groups.length < GROUP_LIMIT){
			this.groupPop.find('div.group-list-btn').show();
		}else{
			this.groupPop.find('div.group-list-btn').hide();
		}
		var offset = $target.offset();
		var groups = $div.attr('data-friends-groups') || '';
		$ul.empty();
		for(var i=0,len=this.groupHash.groups.length;i<len;i+=1){
			$ul.append('<li><label><input type="checkbox"'+ (this.isInGroup(this.groupHash.groups[i].id,groups) ? ' checked="checked"' : '') +' value="'+this.groupHash.groups[i].id+'" />'+this.groupHash.groups[i].name+'</label></li>'); 
		}
		this.groupPop
			.data('friends-div',$div)
			.css({
				top: offset.top + $target.outerHeight(),
				left: offset.left
			})
			.show();
		if($.browser.msie && $.browser.version.substr(0,1) == '6'){
			this.groupPop.width($ul.innerWidth() < GROUP_POP_MINWIDTH ? GROUP_POP_MINWIDTH : $ul.innerWidth());
		}
		$ul.unbind('click.'+app+'pop');
		$ul.bind('click.'+app+'pop',function(event){
			var $target = $(event.target);
			if($target.is(':checkbox')){
				var ckValue = $target.val();
				if($target.is(':checked')){
					$[app].addMapping($div.attr('data-friends-xpt'),ckValue,function(data){
						self.addUserGroups($div,ckValue);
						self.updateCount({
							'gid': ckValue,
							'modify': 1,
							'nogroup': data.noGroupCount
						});
						self.card.clearCache();
					});
				}else{
					$[app].delMapping($div.attr('data-friends-friendid'),ckValue,function(data){
						self.delUserGroups($div,ckValue);
						self.updateCount({
							'gid': ckValue,
							'modify': -1,
							'nogroup': data.noGroupCount
						});
						self.card.clearCache();
					});
				}
			}
		});
		
		setTimeout(function(){
			$(document).bind('mousedown.'+app+'pop',function(event){
				
				if(!$(event.target).closest('.'+GROUP_POP_CLASS).length){
					
					self.hideGroupPop();
				}
			});
		},1);
	},
	hideGroupPop: function(){
		this.groupPop.data('friends-div',null).hide();
		$(document).unbind('mousedown.'+app+'pop');
		
	},
	initGroupPop: function(){
		var self = this;
		var html = '<ul></ul><div class="group-list-btn"><a href="javascript:void(0)"><span>+&nbsp;</span>新建分组</a></div>'
				+'<div class="creat-group-menu" style="display:none">'
				+'<p><input type="text" class="text" value=""></p>'
				+'<p class="app-friends-error"></p>'
				+'<p><span class="ui-btn save"><span>保存</span></span>&nbsp;<span class="ui-btn btn-gray cancel"><span>取消</span></span></p>'
				+'</div>';
		var pop = $('<div class="group-list"></div>')
			.addClass(GROUP_POP_CLASS)
			.css({'position':'absolute','z-index':9999})
			.html(html);
		this.$this.find('div.friend-item-list').append(pop);
		var $new = pop.find('div.group-list-btn');
		var $panel = pop.find('div.creat-group-menu');
		$new.click(function(){
			$panel.find('.app-friends-error').hide().html('');
			if($panel.is(':visible')){
				$panel.hide();
				$new.show();
			}else{
				$panel.show();
				$new.hide();
			}
		});
		var $input = $panel.find('input[type=text]').iPrompt({text: NEW_GROUP_TIP_TEXT,css:{'color':'#999999'}});
		$panel.find('span.ui-btn')
			.eq(0)
			.click(function(){
				var value = $.trim($input.val());
				$input.val(value);
				var re = self.checkGroupName(value);
				if(re.pass){
					$[app].createGroup(value,function(data){
						self.createNewGroup(data);
						self.createPopGroupAndMapping(data);
						$input.val('').blur();
						$panel.hide();
						if(self.groupHash.groups.length < GROUP_LIMIT){
							$new.show();
						}else{
							$new.hide();
						}
					});
				}else{
					$input.focus();
					$panel.find('.app-friends-error').show().html(re.text);
				}
			})
			.end()
			.eq(1)
			.click(function(){
				$input.val('').blur();
				$panel.hide();
				$new.show();
			});
		return pop;
	},
	isInGroup: function(gid,groups){
		if(groups == ''){
			return false;
		};
		groups += '';
		var ag = groups.split(',');
		for(var i=0;i<ag.length;i+=1){
			if(ag[i] == gid){
				return true;
			}
		}
		return false;
	},
	addUserGroups: function($div,gid){
		var groups = $div.attr('data-friends-groups') || '',tmpA;
		groups += '';
		if(!this.isInGroup(gid,groups)){
			if(groups == ''){
				groups = gid;
			}else{
				tmpA = groups.split(',');
				tmpA.push(gid);
				groups = tmpA.join(',');
			}
		}
		$div.attr('data-friends-groups',groups);
		this.setUserGroupsName($div);
	},
	delUserGroups: function($div,gid){
		var groups = $div.attr('data-friends-groups') || '',tmpA = [];
		groups += '';
		if(this.isInGroup(gid,groups)){
			var ag = groups.split(',');
			for(var i=0;i<ag.length;i+=1){
				if(ag[i] != gid && ag[i] != ''){
					tmpA[tmpA.length] = ag[i];
				}
			}
			groups = tmpA.join(',');
		}
		//如果取消的分组就是当前分组，则移除该
		if(gid == this.groupHash.curgroup){
			$div.slideUp('slow',function(){
				$div.remove();
			});
			this.hideGroupPop();
		}else{
			$div.attr('data-friends-groups',groups);
			this.setUserGroupsName($div);
		}
	},
	setUserGroupsName: function($div){
		var groups = $div.attr('data-friends-groups') || '';
		
		var groupNames = '未分组',tmpA = [];
		for(var i=0,len=this.groupHash.groups.length;i<len;i+=1){
			
			if(this.isInGroup(this.groupHash.groups[i].id,groups)){
				tmpA[tmpA.length] = this.groupHash.groups[i].name;
			}
		}
		if(tmpA.length == 1){
			groupNames = $[app].utils.cutCjkString(tmpA[0],14,'...',2);
		}else if(tmpA.length == 2){ 
			groupNames = $[app].utils.cutCjkString(tmpA[0]+','+tmpA[1],14,'...',2);
		}else if(tmpA.length > 2){
			groupNames = tmpA[0]+','+tmpA[1];
			if($[app].utils.cjkLength(groupNames) <= 12){
				groupNames += '...';
			}else{
				groupNames = $[app].utils.cutCjkString(groupNames,14,'...',2);
			}
		}
		$div.find('div.set-group > a').html(groupNames+'<span class="icon"></span>');
	},
	/*
	取消跟随时，更新 总跟随数 和 该人所属分组 的数字
	@param {
		groups: '1,2,3,4' 取消跟随时，这个人对应的分组都要减1
		gid: '1' 针对单个分组做的操作
		modify: -1 or 1 是做+1 还是做 -1 的操作
		nogroup: xxx 未分组数，由服务器返回
 	}
	*/
	
	updateCount: function(param){
		var i,len,hash = {};
		if(!$[app].utils.isUndefined(param.groups)){
			this.groupHash.total = parseInt(this.groupHash.total,10) - 1;
			if(param.groups == ''){
				this.groupHash.nogroup = parseInt(this.groupHash.nogroup,10) - 1;
			}
			for(i=0,len=this.groupHash.groups.length;i<len;i+=1){
				if(this.isInGroup(this.groupHash.groups[i].id,param.groups)){
					this.groupHash.groups[i].count = parseInt(this.groupHash.groups[i].count,10) - 1;
				}
				hash[this.groupHash.groups[i].id] = this.groupHash.groups[i].count;
			}
		}else if(param.gid){
			if(!$[app].utils.isUndefined(param.nogroup)){
				this.groupHash.nogroup = param.nogroup;
			}
			for(i=0,len=this.groupHash.groups.length;i<len;i+=1){
				if(this.groupHash.groups[i].id == param.gid){
					this.groupHash.groups[i].count = parseInt(this.groupHash.groups[i].count,10) + param.modify;
				}
				hash[this.groupHash.groups[i].id] = this.groupHash.groups[i].count;
			}
		}
		hash['-1'] = this.groupHash.nogroup;
		var $follow = this.$this.find('div.app-left > div.friend-search > div.follow');
		if($follow.length){
			$follow.html($follow.text().replace(/\d+/,this.groupHash.total));
		}
		var $rightFollow = this.$this.find('div.app-right li:eq(0)');
		if($rightFollow.length){
			$rightFollow.find('b').html(this.groupHash.total);
		}
		this.$this.find('div.app-right li[app-friends-groupid]').each(function(){
			var $li = $(this);
			var gid = $li.attr('app-friends-groupid');
			if(!$[app].utils.isUndefined(hash[gid])){
				
				$li.find('b').html(hash[gid]);
			}
		});
		if(this.groupHash.curgroup > 0){
			this.$this.find('.friend-list-console em').html(hash[this.groupHash.curgroup]);
		}

	},
	/*
	新建分组
	*/
	toogleCreateGroup: function($btn){
		var $panel = this.$this.find('.app-friends-addgroup-panel');
		$panel.find('.app-friends-error').hide().html('');
		if($panel.is(':visible')){
			$panel.hide('slide',{'direction':'up'},function(){
				$btn.show();
			});
		}else{
			$panel.show('slide',{'direction':'up'});
			$btn.hide();
		}
		if(!$panel.data('isInited')){
			this.initGroupPanel($btn,$panel);
		}
	},
	initGroupPanel: function($btn,$panel){
		var self = this;
		var $input = $panel.find('input[type=text]').iPrompt({text: NEW_GROUP_TIP_TEXT,css:{'color':'#999999'}});
		$panel.find('span.ui-btn')
			.eq(0)
			.click(function(){
				var value = $.trim($input.val());
				$input.val(value);
				var re = self.checkGroupName(value);
				if(re.pass){
					$[app].createGroup(value,function(data){
						self.createNewGroup(data);
					});
				}else{
					$panel.find('.app-friends-error').show().html(re.text);
				}
			})
			.end()
			.eq(1)
			.click(function(){
				$input.val('').blur();
				$panel.hide('slide',{'direction':'up'},function(){
					if(self.groupHash.groups.length < GROUP_LIMIT){
						$btn.show();
					}
				});
			});
		$panel.data('isInited',true);
	},
	checkGroupName: function(gname){
		var re = {
			pass: true,
			text: ''
		};
		if(gname == '' || gname == NEW_GROUP_TIP_TEXT){
			re.pass = false;
			re.text = '请输入新分组名称';
			return re;
		}
		if($[app].utils.cjkLength(gname) > 16){
			re.pass = false;
			re.text = '请不要超过16个字符';
			return re;
		};
		for(var i=0,len=this.groupHash.groups.length;i<len;i+=1){
			if(this.groupHash.groups[i].name == gname || gname == '未分组'){
				re.pass = false;
				re.text = '此分组名已存在';
				return re;
			}
		};
		return re;
	},
	createNewGroup: function(data){
		this.groupHash.groups.push({
			name : data.gname,
			id : data.gid,
			count: 0
		});
		var $lis = this.$this.find('div.app-right > div.follow-list li');
		var $li = $('<li app-friends-groupid="'+data.gid+'"><a href="javascript:void(0);" data-target="#friend-canvas" data-url="/a/app/friend/friend/atts.do?groupId='+data.gid+'" data-role="appview">'+data.gname+'<em>(<b>0</b>)</em></a></li>');
		$li.insertBefore($lis.last());
		$li.hover(function(){
			$(this).addClass('active');
		},
		function(){
			$(this).removeClass('active');
		});
		//更新右侧新建分组状态
		var $panel = this.$this.find('.app-friends-addgroup-panel');
		var $btn = this.$this.find('.app-friends-addgroup');
		if(this.groupHash.groups.length < GROUP_LIMIT){
			//小于最大分组数
			$panel.hide();
			$panel.find('input[type=text]').val('').blur();
			$btn.show();
		}else{
			$panel.hide();
			$btn.hide();
			$btn.parent().html('分组数达到上限');
		}

	},
	createPopGroupAndMapping: function(gdata){
		var self = this;
		var $div = this.groupPop.data('friends-div');
		var gid = gdata.gid;
		var gname = gdata.gname;
		if($div){
			$[app].addMapping($div.attr('data-friends-xpt'),gid,function(data){
					self.addUserGroups($div,gid);
					self.updateCount({
						'gid': gid,
						'modify': 1,
						'nogroup': data.noGroupCount
					});
					self.groupPop.find('ul').append('<li><label><input type="checkbox" checked="checked" value="'+gid+'" />'+gname+'</label></li>');
					if($.browser.msie && $.browser.version.substr(0,1) == '6'){
						self.groupPop.width(self.groupPop.find('ul').innerWidth() < GROUP_POP_MINWIDTH ? GROUP_POP_MINWIDTH : self.groupPop.find('ul').innerWidth());
					}
			});
		}
	},
	setDesc: function($div,desc){
		var self = this;
		var html = '<div class="set-remark-window clearfix">'
				+ '<p>请输入备注名字，方便认出TA是谁</p>'
				+ '<p><input type="text" value=""></p>'
				+ '<p style="display:none;" class="error-box"><span class="app-friends-error"></span></p>'
				+ '</div>';
		var friendid = $div.attr('data-friends-friendid');
		var $content = $(html);
		var $dialog = $.dialog({
			className: "jquery-btn-boxA",
			btns: ["accept", "cancel"],
			labAccept: '确定',
			labCancel: '取消',
			title: '设置备注名',
			content: $content,
			onBeforeAccept: function(){
				var $input = $dialog.find('.set-remark-window input[type=text]');
				var value = $.trim($input.val());
				$input.val(value);
				if($[app].utils.cjkLength(value) > 16){
					$dialog.find('.set-remark-window span.app-friends-error').html('请不要超过16个字符').parent().show();
					$dialog.adjust();
					return false;
				}else{
					if(value != desc){
						if(value == ''){
							//清空备注
							$[app].setDesc(friendid,value,function(data){
								$div.find('.app-friends-remark-edit')
									.removeClass('app-friends-remark-edit')
									.addClass('app-friends-remark-add')
									.css('visibility','hidden')
									.find('a')
									.text('设置备注');
								self.card.clearCache();
							});
						}else{
							//设置备注
							$[app].setDesc(friendid,value,function(data){
								if($div.find('.app-friends-remark-edit').length){
									$div.find('.app-friends-remark-edit').find('a').text(value);
								}else if($div.find('.app-friends-remark-add').length){
									$div.find('.app-friends-remark-add')
									.removeClass('app-friends-remark-add')
									.addClass('app-friends-remark-edit')
									.css('visibility','visible')
									.find('a')
									.html(data.desc.replace(/&amp;/g,'&'));
								}
								self.card.clearCache();
							});
						}
					}
					
				}
			}
		});
		$content.find('input[type=text]').val(desc).focus();
	},
	getCurGroupName: function(){
		for(var i=0,len=this.groupHash.groups.length;i<len;i+=1){
			if(this.groupHash.groups[i].id == this.groupHash.curgroup){
				return this.groupHash.groups[i].name;
			}
		}
	},
	updateGroupName: function(){
		var gname = '',self = this;
		if(this.groupHash.curgroup <= 0){
			return;
		}
		gname = this.getCurGroupName();
	
		var html = '<div class="amend-group-window clearfix">'
				+ '<p><label>分组名：</label>&nbsp;<input type="text" value=""></p>'
				+ '<p style="display:none">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="app-friends-error"></span></p>'
				+ '</div>';
		var $content = $(html);
		var $dialog = $.dialog({
			className: "",
			btns: ["accept", "cancel"],
			labAccept: '确定',
			labCancel: '取消',
			title: '修改分组名称',
			content: $content,
			onBeforeAccept: function(){
				var $input = $dialog.find('.amend-group-window input[type=text]');
				var value = $.trim($input.val());
				$input.val(value);
				if(value != gname){
					var re = self.checkGroupName(value);
					if(re.pass){
						$[app].updateGroup(self.groupHash.curgroup,value,function(data){
							$[app].pageview.call(self.$this,'attsManage',{url:'/a/app/friend/friend/atts.do?groupId='+data.gid});//删除成功后，刷新到全部
						})
					}else{
						$dialog.find('.app-friends-error').html(re.text).parent().show();
						$dialog.adjust();
						$input.focus();
						return false;
					}
				}
			}
		});
		$content.find('input[type=text]').val(gname).select();
	},
	delGroup: function(){
		if(this.groupHash.curgroup <= 0){
			return;
		}
		var self = this;
		var gname = this.getCurGroupName();
		var html = '<div class="set-clew-window">'
				+ '<h2>确定要删除“'+gname+'”分组吗？</h2>'
				+ '<p>此分组下的人不会被取消跟随。</p>'
				+ '</div>';
		
		$.confirm({
			content: html,
			labConfirm: '确定',
			labCancel: '取消',
			title: false,
			onConfirm: function() {
				$[app].delGroup(self.groupHash.curgroup,function(){
					$[app].pageview.call(self.$this,'attsManage');//删除成功后，刷新到全部
				});
				return false;
			}
		});

	},
	getSentence: function(){
		var self = this,$divs = this.$this.find('div[data-friends-xpt]');
		var xpts = [];
		$divs.each(function(){
			var $o = $(this);
			if($o.attr('data-friends-xpt') != ''){
				xpts[xpts.length] = $o.attr('data-friends-xpt');
			}
		});
		$[app].sentence(xpts,function(data){
			self.fillSentence(data)
		});
	},
	fillSentence: function(data){
		var ary = data.sentences;
		if($.isArray(ary)){
			for(var i=0,len=ary.length;i<len;i+=1){
				var obj = ary[i];
				var $div = this.$this.find('div[data-friends-xpt="'+obj.xpt+'"]');
				if($div.length){
					$div.find('div.user-feed').html(obj.content);
					$div.find('div.feed-data').html('('+obj.createtime+')');
				}
			}
		}
	},
	findDiv: function(param){
		if(param.xpt){
			return this.$this.find('div[data-friends-xpt="'+param.xpt+'"]');
		}else if(param.friendid){
			return this.$this.find('div[data-friends-friendid="'+param.xpt+'"]');
		}
		return null;
	},
	initCard: function(){
		var self = this;
		
		this.card = new $.iCard({
			bindElement: '#friend-canvas',
			onSetDesc: function(param){
				var $div = self.findDiv(param);
				if(param.desc == ''){
					$div.find('.app-friends-remark-edit')
						.removeClass('app-friends-remark-edit')
						.addClass('app-friends-remark-add')
						.css('visibility','hidden')
						.find('a')
						.text('设置备注');
				}else{
					if($div.find('.app-friends-remark-edit').length){
						$div.find('.app-friends-remark-edit').find('a').text(param.desc);
					}else if($div.find('.app-friends-remark-add').length){
						$div.find('.app-friends-remark-add')
						.removeClass('app-friends-remark-add')
						.addClass('app-friends-remark-edit')
						.css('visibility','visible')
						.find('a')
						.html(param.desc.replace(/&amp;/g,'&'));
					}
				}
				//end
			},
			onCreateGroup: function(param){
				self.createNewGroup(param);
			},
			onSetGroup: function(param){
				var $div = self.findDiv(param),i,len;
				var oldGroups = ($div.attr('data-friends-groups') || '').split(',');
				var newGroups = param.groupids.split(',');
				for(i = 0,len = oldGroups.length;i < len;i += 1){
					self.updateCount({
						'gid': oldGroups[i],
						'modify': -1,
						'nogroup': param.noGroupCount
					});
				}
				for(i = 0,len = newGroups.length;i < len;i += 1){
					self.updateCount({
						'gid': newGroups[i],
						'modify': 1,
						'nogroup': param.noGroupCount
					});
				}
				$div.attr('data-friends-groups',param.groupids);
				self.setUserGroupsName($div);
			},
			onFollow: function(param){
				
			},
			onUnfollow: function(param){
				var $div = self.findDiv(param);
				$div.slideUp('slow',function(){
					$div.remove();
				});
				self.updateCount({
					'groups': $div.attr('data-friends-groups') || ''
				});
				self.card.hide(0);
				$[app].removeRecommend(param.xpt,function(){});
			}
		});
	}

};


$[app][PAGE_NAME+'Boot'] = function(options) {
	var $this = this;
	return $this;
};

$[app][PAGE_NAME+'Load'] = function(options) {
	$[app].onPageLoaded();
	var $this = $('#friend-canvas');
	project.init($this,options);
	return $this;
};


})(jQuery);