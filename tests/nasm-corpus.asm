bits 16
cpu 586
add al, cl
add dh, al
add cl, [bx]
add [bx], dh
add cl, [bp]
add [bp], dh
add cl, [si]
add [si], dh
add cl, [di]
add [di], dh
add cl, [bx+si]
add [bx+si], dh
add cl, [bx+di]
add [bx+di], dh
add cl, [bp+si]
add [bp+si], dh
add cl, [bp+di+4]
add [bp+di+4], dh
add al, 0
add cl, 0
add byte [di], 0
add al, 1
add cl, 1
add byte [di], 1
add al, -1
add cl, -1
add byte [di], -1
add al, 127
add cl, 127
add byte [di], 127
add al, 128
add cl, 128
add byte [di], 128
add al, -128
add cl, -128
add byte [di], -128
add al, 255
add cl, 255
add byte [di], 255
add ax, cx
add bx, ax
add cx, [bx]
add [bx], bx
add cx, [bp]
add [bp], bx
add cx, [si]
add [si], bx
add cx, [di]
add [di], bx
add cx, [bx+si]
add [bx+si], bx
add cx, [bx+di]
add [bx+di], bx
add cx, [bp+si]
add [bp+si], bx
add cx, [bp+di+4]
add [bp+di+4], bx
add ax, 0
add cx, 0
add word [di], 0
add ax, 1
add cx, 1
add word [di], 1
add ax, -1
add cx, -1
add word [di], -1
add ax, 127
add cx, 127
add word [di], 127
add ax, 128
add cx, 128
add word [di], 128
add ax, -128
add cx, -128
add word [di], -128
add ax, -129
add cx, -129
add word [di], -129
add ax, 255
add cx, 255
add word [di], 255
add ax, 0x1234
add cx, 0x1234
add word [di], 0x1234
add ax, -300
add cx, -300
add word [di], -300
add eax, ecx
add ebx, eax
add ecx, [bx]
add [bx], ebx
add ecx, [bp]
add [bp], ebx
add ecx, [si]
add [si], ebx
add ecx, [di]
add [di], ebx
add ecx, [bx+si]
add [bx+si], ebx
add ecx, [bx+di]
add [bx+di], ebx
add ecx, [bp+si]
add [bp+si], ebx
add ecx, [bp+di+4]
add [bp+di+4], ebx
add eax, 0
add ecx, 0
add dword [di], 0
add eax, 1
add ecx, 1
add dword [di], 1
add eax, -1
add ecx, -1
add dword [di], -1
add eax, 127
add ecx, 127
add dword [di], 127
add eax, 128
add ecx, 128
add dword [di], 128
add eax, -128
add ecx, -128
add dword [di], -128
add eax, -129
add ecx, -129
add dword [di], -129
add eax, 255
add ecx, 255
add dword [di], 255
add eax, 0x1234
add ecx, 0x1234
add dword [di], 0x1234
add eax, -300
add ecx, -300
add dword [di], -300
add al, [dados]
add ax, [dados]
add eax, [dados]
add [dados], al
add [dados], eax
or al, cl
or dh, al
or cl, [bx]
or [bx], dh
or cl, [bp]
or [bp], dh
or cl, [si]
or [si], dh
or cl, [di]
or [di], dh
or cl, [bx+si]
or [bx+si], dh
or cl, [bx+di]
or [bx+di], dh
or cl, [bp+si]
or [bp+si], dh
or cl, [bp+di+4]
or [bp+di+4], dh
or al, 0
or cl, 0
or byte [di], 0
or al, 1
or cl, 1
or byte [di], 1
or al, -1
or cl, -1
or byte [di], -1
or al, 127
or cl, 127
or byte [di], 127
or al, 128
or cl, 128
or byte [di], 128
or al, -128
or cl, -128
or byte [di], -128
or al, 255
or cl, 255
or byte [di], 255
or ax, cx
or bx, ax
or cx, [bx]
or [bx], bx
or cx, [bp]
or [bp], bx
or cx, [si]
or [si], bx
or cx, [di]
or [di], bx
or cx, [bx+si]
or [bx+si], bx
or cx, [bx+di]
or [bx+di], bx
or cx, [bp+si]
or [bp+si], bx
or cx, [bp+di+4]
or [bp+di+4], bx
or ax, 0
or cx, 0
or word [di], 0
or ax, 1
or cx, 1
or word [di], 1
or ax, -1
or cx, -1
or word [di], -1
or ax, 127
or cx, 127
or word [di], 127
or ax, 128
or cx, 128
or word [di], 128
or ax, -128
or cx, -128
or word [di], -128
or ax, -129
or cx, -129
or word [di], -129
or ax, 255
or cx, 255
or word [di], 255
or ax, 0x1234
or cx, 0x1234
or word [di], 0x1234
or ax, -300
or cx, -300
or word [di], -300
or eax, ecx
or ebx, eax
or ecx, [bx]
or [bx], ebx
or ecx, [bp]
or [bp], ebx
or ecx, [si]
or [si], ebx
or ecx, [di]
or [di], ebx
or ecx, [bx+si]
or [bx+si], ebx
or ecx, [bx+di]
or [bx+di], ebx
or ecx, [bp+si]
or [bp+si], ebx
or ecx, [bp+di+4]
or [bp+di+4], ebx
or eax, 0
or ecx, 0
or dword [di], 0
or eax, 1
or ecx, 1
or dword [di], 1
or eax, -1
or ecx, -1
or dword [di], -1
or eax, 127
or ecx, 127
or dword [di], 127
or eax, 128
or ecx, 128
or dword [di], 128
or eax, -128
or ecx, -128
or dword [di], -128
or eax, -129
or ecx, -129
or dword [di], -129
or eax, 255
or ecx, 255
or dword [di], 255
or eax, 0x1234
or ecx, 0x1234
or dword [di], 0x1234
or eax, -300
or ecx, -300
or dword [di], -300
or al, [dados]
or ax, [dados]
or eax, [dados]
or [dados], al
or [dados], eax
adc al, cl
adc dh, al
adc cl, [bx]
adc [bx], dh
adc cl, [bp]
adc [bp], dh
adc cl, [si]
adc [si], dh
adc cl, [di]
adc [di], dh
adc cl, [bx+si]
adc [bx+si], dh
adc cl, [bx+di]
adc [bx+di], dh
adc cl, [bp+si]
adc [bp+si], dh
adc cl, [bp+di+4]
adc [bp+di+4], dh
adc al, 0
adc cl, 0
adc byte [di], 0
adc al, 1
adc cl, 1
adc byte [di], 1
adc al, -1
adc cl, -1
adc byte [di], -1
adc al, 127
adc cl, 127
adc byte [di], 127
adc al, 128
adc cl, 128
adc byte [di], 128
adc al, -128
adc cl, -128
adc byte [di], -128
adc al, 255
adc cl, 255
adc byte [di], 255
adc ax, cx
adc bx, ax
adc cx, [bx]
adc [bx], bx
adc cx, [bp]
adc [bp], bx
adc cx, [si]
adc [si], bx
adc cx, [di]
adc [di], bx
adc cx, [bx+si]
adc [bx+si], bx
adc cx, [bx+di]
adc [bx+di], bx
adc cx, [bp+si]
adc [bp+si], bx
adc cx, [bp+di+4]
adc [bp+di+4], bx
adc ax, 0
adc cx, 0
adc word [di], 0
adc ax, 1
adc cx, 1
adc word [di], 1
adc ax, -1
adc cx, -1
adc word [di], -1
adc ax, 127
adc cx, 127
adc word [di], 127
adc ax, 128
adc cx, 128
adc word [di], 128
adc ax, -128
adc cx, -128
adc word [di], -128
adc ax, -129
adc cx, -129
adc word [di], -129
adc ax, 255
adc cx, 255
adc word [di], 255
adc ax, 0x1234
adc cx, 0x1234
adc word [di], 0x1234
adc ax, -300
adc cx, -300
adc word [di], -300
adc eax, ecx
adc ebx, eax
adc ecx, [bx]
adc [bx], ebx
adc ecx, [bp]
adc [bp], ebx
adc ecx, [si]
adc [si], ebx
adc ecx, [di]
adc [di], ebx
adc ecx, [bx+si]
adc [bx+si], ebx
adc ecx, [bx+di]
adc [bx+di], ebx
adc ecx, [bp+si]
adc [bp+si], ebx
adc ecx, [bp+di+4]
adc [bp+di+4], ebx
adc eax, 0
adc ecx, 0
adc dword [di], 0
adc eax, 1
adc ecx, 1
adc dword [di], 1
adc eax, -1
adc ecx, -1
adc dword [di], -1
adc eax, 127
adc ecx, 127
adc dword [di], 127
adc eax, 128
adc ecx, 128
adc dword [di], 128
adc eax, -128
adc ecx, -128
adc dword [di], -128
adc eax, -129
adc ecx, -129
adc dword [di], -129
adc eax, 255
adc ecx, 255
adc dword [di], 255
adc eax, 0x1234
adc ecx, 0x1234
adc dword [di], 0x1234
adc eax, -300
adc ecx, -300
adc dword [di], -300
adc al, [dados]
adc ax, [dados]
adc eax, [dados]
adc [dados], al
adc [dados], eax
sbb al, cl
sbb dh, al
sbb cl, [bx]
sbb [bx], dh
sbb cl, [bp]
sbb [bp], dh
sbb cl, [si]
sbb [si], dh
sbb cl, [di]
sbb [di], dh
sbb cl, [bx+si]
sbb [bx+si], dh
sbb cl, [bx+di]
sbb [bx+di], dh
sbb cl, [bp+si]
sbb [bp+si], dh
sbb cl, [bp+di+4]
sbb [bp+di+4], dh
sbb al, 0
sbb cl, 0
sbb byte [di], 0
sbb al, 1
sbb cl, 1
sbb byte [di], 1
sbb al, -1
sbb cl, -1
sbb byte [di], -1
sbb al, 127
sbb cl, 127
sbb byte [di], 127
sbb al, 128
sbb cl, 128
sbb byte [di], 128
sbb al, -128
sbb cl, -128
sbb byte [di], -128
sbb al, 255
sbb cl, 255
sbb byte [di], 255
sbb ax, cx
sbb bx, ax
sbb cx, [bx]
sbb [bx], bx
sbb cx, [bp]
sbb [bp], bx
sbb cx, [si]
sbb [si], bx
sbb cx, [di]
sbb [di], bx
sbb cx, [bx+si]
sbb [bx+si], bx
sbb cx, [bx+di]
sbb [bx+di], bx
sbb cx, [bp+si]
sbb [bp+si], bx
sbb cx, [bp+di+4]
sbb [bp+di+4], bx
sbb ax, 0
sbb cx, 0
sbb word [di], 0
sbb ax, 1
sbb cx, 1
sbb word [di], 1
sbb ax, -1
sbb cx, -1
sbb word [di], -1
sbb ax, 127
sbb cx, 127
sbb word [di], 127
sbb ax, 128
sbb cx, 128
sbb word [di], 128
sbb ax, -128
sbb cx, -128
sbb word [di], -128
sbb ax, -129
sbb cx, -129
sbb word [di], -129
sbb ax, 255
sbb cx, 255
sbb word [di], 255
sbb ax, 0x1234
sbb cx, 0x1234
sbb word [di], 0x1234
sbb ax, -300
sbb cx, -300
sbb word [di], -300
sbb eax, ecx
sbb ebx, eax
sbb ecx, [bx]
sbb [bx], ebx
sbb ecx, [bp]
sbb [bp], ebx
sbb ecx, [si]
sbb [si], ebx
sbb ecx, [di]
sbb [di], ebx
sbb ecx, [bx+si]
sbb [bx+si], ebx
sbb ecx, [bx+di]
sbb [bx+di], ebx
sbb ecx, [bp+si]
sbb [bp+si], ebx
sbb ecx, [bp+di+4]
sbb [bp+di+4], ebx
sbb eax, 0
sbb ecx, 0
sbb dword [di], 0
sbb eax, 1
sbb ecx, 1
sbb dword [di], 1
sbb eax, -1
sbb ecx, -1
sbb dword [di], -1
sbb eax, 127
sbb ecx, 127
sbb dword [di], 127
sbb eax, 128
sbb ecx, 128
sbb dword [di], 128
sbb eax, -128
sbb ecx, -128
sbb dword [di], -128
sbb eax, -129
sbb ecx, -129
sbb dword [di], -129
sbb eax, 255
sbb ecx, 255
sbb dword [di], 255
sbb eax, 0x1234
sbb ecx, 0x1234
sbb dword [di], 0x1234
sbb eax, -300
sbb ecx, -300
sbb dword [di], -300
sbb al, [dados]
sbb ax, [dados]
sbb eax, [dados]
sbb [dados], al
sbb [dados], eax
and al, cl
and dh, al
and cl, [bx]
and [bx], dh
and cl, [bp]
and [bp], dh
and cl, [si]
and [si], dh
and cl, [di]
and [di], dh
and cl, [bx+si]
and [bx+si], dh
and cl, [bx+di]
and [bx+di], dh
and cl, [bp+si]
and [bp+si], dh
and cl, [bp+di+4]
and [bp+di+4], dh
and al, 0
and cl, 0
and byte [di], 0
and al, 1
and cl, 1
and byte [di], 1
and al, -1
and cl, -1
and byte [di], -1
and al, 127
and cl, 127
and byte [di], 127
and al, 128
and cl, 128
and byte [di], 128
and al, -128
and cl, -128
and byte [di], -128
and al, 255
and cl, 255
and byte [di], 255
and ax, cx
and bx, ax
and cx, [bx]
and [bx], bx
and cx, [bp]
and [bp], bx
and cx, [si]
and [si], bx
and cx, [di]
and [di], bx
and cx, [bx+si]
and [bx+si], bx
and cx, [bx+di]
and [bx+di], bx
and cx, [bp+si]
and [bp+si], bx
and cx, [bp+di+4]
and [bp+di+4], bx
and ax, 0
and cx, 0
and word [di], 0
and ax, 1
and cx, 1
and word [di], 1
and ax, -1
and cx, -1
and word [di], -1
and ax, 127
and cx, 127
and word [di], 127
and ax, 128
and cx, 128
and word [di], 128
and ax, -128
and cx, -128
and word [di], -128
and ax, -129
and cx, -129
and word [di], -129
and ax, 255
and cx, 255
and word [di], 255
and ax, 0x1234
and cx, 0x1234
and word [di], 0x1234
and ax, -300
and cx, -300
and word [di], -300
and eax, ecx
and ebx, eax
and ecx, [bx]
and [bx], ebx
and ecx, [bp]
and [bp], ebx
and ecx, [si]
and [si], ebx
and ecx, [di]
and [di], ebx
and ecx, [bx+si]
and [bx+si], ebx
and ecx, [bx+di]
and [bx+di], ebx
and ecx, [bp+si]
and [bp+si], ebx
and ecx, [bp+di+4]
and [bp+di+4], ebx
and eax, 0
and ecx, 0
and dword [di], 0
and eax, 1
and ecx, 1
and dword [di], 1
and eax, -1
and ecx, -1
and dword [di], -1
and eax, 127
and ecx, 127
and dword [di], 127
and eax, 128
and ecx, 128
and dword [di], 128
and eax, -128
and ecx, -128
and dword [di], -128
and eax, -129
and ecx, -129
and dword [di], -129
and eax, 255
and ecx, 255
and dword [di], 255
and eax, 0x1234
and ecx, 0x1234
and dword [di], 0x1234
and eax, -300
and ecx, -300
and dword [di], -300
and al, [dados]
and ax, [dados]
and eax, [dados]
and [dados], al
and [dados], eax
sub al, cl
sub dh, al
sub cl, [bx]
sub [bx], dh
sub cl, [bp]
sub [bp], dh
sub cl, [si]
sub [si], dh
sub cl, [di]
sub [di], dh
sub cl, [bx+si]
sub [bx+si], dh
sub cl, [bx+di]
sub [bx+di], dh
sub cl, [bp+si]
sub [bp+si], dh
sub cl, [bp+di+4]
sub [bp+di+4], dh
sub al, 0
sub cl, 0
sub byte [di], 0
sub al, 1
sub cl, 1
sub byte [di], 1
sub al, -1
sub cl, -1
sub byte [di], -1
sub al, 127
sub cl, 127
sub byte [di], 127
sub al, 128
sub cl, 128
sub byte [di], 128
sub al, -128
sub cl, -128
sub byte [di], -128
sub al, 255
sub cl, 255
sub byte [di], 255
sub ax, cx
sub bx, ax
sub cx, [bx]
sub [bx], bx
sub cx, [bp]
sub [bp], bx
sub cx, [si]
sub [si], bx
sub cx, [di]
sub [di], bx
sub cx, [bx+si]
sub [bx+si], bx
sub cx, [bx+di]
sub [bx+di], bx
sub cx, [bp+si]
sub [bp+si], bx
sub cx, [bp+di+4]
sub [bp+di+4], bx
sub ax, 0
sub cx, 0
sub word [di], 0
sub ax, 1
sub cx, 1
sub word [di], 1
sub ax, -1
sub cx, -1
sub word [di], -1
sub ax, 127
sub cx, 127
sub word [di], 127
sub ax, 128
sub cx, 128
sub word [di], 128
sub ax, -128
sub cx, -128
sub word [di], -128
sub ax, -129
sub cx, -129
sub word [di], -129
sub ax, 255
sub cx, 255
sub word [di], 255
sub ax, 0x1234
sub cx, 0x1234
sub word [di], 0x1234
sub ax, -300
sub cx, -300
sub word [di], -300
sub eax, ecx
sub ebx, eax
sub ecx, [bx]
sub [bx], ebx
sub ecx, [bp]
sub [bp], ebx
sub ecx, [si]
sub [si], ebx
sub ecx, [di]
sub [di], ebx
sub ecx, [bx+si]
sub [bx+si], ebx
sub ecx, [bx+di]
sub [bx+di], ebx
sub ecx, [bp+si]
sub [bp+si], ebx
sub ecx, [bp+di+4]
sub [bp+di+4], ebx
sub eax, 0
sub ecx, 0
sub dword [di], 0
sub eax, 1
sub ecx, 1
sub dword [di], 1
sub eax, -1
sub ecx, -1
sub dword [di], -1
sub eax, 127
sub ecx, 127
sub dword [di], 127
sub eax, 128
sub ecx, 128
sub dword [di], 128
sub eax, -128
sub ecx, -128
sub dword [di], -128
sub eax, -129
sub ecx, -129
sub dword [di], -129
sub eax, 255
sub ecx, 255
sub dword [di], 255
sub eax, 0x1234
sub ecx, 0x1234
sub dword [di], 0x1234
sub eax, -300
sub ecx, -300
sub dword [di], -300
sub al, [dados]
sub ax, [dados]
sub eax, [dados]
sub [dados], al
sub [dados], eax
xor al, cl
xor dh, al
xor cl, [bx]
xor [bx], dh
xor cl, [bp]
xor [bp], dh
xor cl, [si]
xor [si], dh
xor cl, [di]
xor [di], dh
xor cl, [bx+si]
xor [bx+si], dh
xor cl, [bx+di]
xor [bx+di], dh
xor cl, [bp+si]
xor [bp+si], dh
xor cl, [bp+di+4]
xor [bp+di+4], dh
xor al, 0
xor cl, 0
xor byte [di], 0
xor al, 1
xor cl, 1
xor byte [di], 1
xor al, -1
xor cl, -1
xor byte [di], -1
xor al, 127
xor cl, 127
xor byte [di], 127
xor al, 128
xor cl, 128
xor byte [di], 128
xor al, -128
xor cl, -128
xor byte [di], -128
xor al, 255
xor cl, 255
xor byte [di], 255
xor ax, cx
xor bx, ax
xor cx, [bx]
xor [bx], bx
xor cx, [bp]
xor [bp], bx
xor cx, [si]
xor [si], bx
xor cx, [di]
xor [di], bx
xor cx, [bx+si]
xor [bx+si], bx
xor cx, [bx+di]
xor [bx+di], bx
xor cx, [bp+si]
xor [bp+si], bx
xor cx, [bp+di+4]
xor [bp+di+4], bx
xor ax, 0
xor cx, 0
xor word [di], 0
xor ax, 1
xor cx, 1
xor word [di], 1
xor ax, -1
xor cx, -1
xor word [di], -1
xor ax, 127
xor cx, 127
xor word [di], 127
xor ax, 128
xor cx, 128
xor word [di], 128
xor ax, -128
xor cx, -128
xor word [di], -128
xor ax, -129
xor cx, -129
xor word [di], -129
xor ax, 255
xor cx, 255
xor word [di], 255
xor ax, 0x1234
xor cx, 0x1234
xor word [di], 0x1234
xor ax, -300
xor cx, -300
xor word [di], -300
xor eax, ecx
xor ebx, eax
xor ecx, [bx]
xor [bx], ebx
xor ecx, [bp]
xor [bp], ebx
xor ecx, [si]
xor [si], ebx
xor ecx, [di]
xor [di], ebx
xor ecx, [bx+si]
xor [bx+si], ebx
xor ecx, [bx+di]
xor [bx+di], ebx
xor ecx, [bp+si]
xor [bp+si], ebx
xor ecx, [bp+di+4]
xor [bp+di+4], ebx
xor eax, 0
xor ecx, 0
xor dword [di], 0
xor eax, 1
xor ecx, 1
xor dword [di], 1
xor eax, -1
xor ecx, -1
xor dword [di], -1
xor eax, 127
xor ecx, 127
xor dword [di], 127
xor eax, 128
xor ecx, 128
xor dword [di], 128
xor eax, -128
xor ecx, -128
xor dword [di], -128
xor eax, -129
xor ecx, -129
xor dword [di], -129
xor eax, 255
xor ecx, 255
xor dword [di], 255
xor eax, 0x1234
xor ecx, 0x1234
xor dword [di], 0x1234
xor eax, -300
xor ecx, -300
xor dword [di], -300
xor al, [dados]
xor ax, [dados]
xor eax, [dados]
xor [dados], al
xor [dados], eax
cmp al, cl
cmp dh, al
cmp cl, [bx]
cmp [bx], dh
cmp cl, [bp]
cmp [bp], dh
cmp cl, [si]
cmp [si], dh
cmp cl, [di]
cmp [di], dh
cmp cl, [bx+si]
cmp [bx+si], dh
cmp cl, [bx+di]
cmp [bx+di], dh
cmp cl, [bp+si]
cmp [bp+si], dh
cmp cl, [bp+di+4]
cmp [bp+di+4], dh
cmp al, 0
cmp cl, 0
cmp byte [di], 0
cmp al, 1
cmp cl, 1
cmp byte [di], 1
cmp al, -1
cmp cl, -1
cmp byte [di], -1
cmp al, 127
cmp cl, 127
cmp byte [di], 127
cmp al, 128
cmp cl, 128
cmp byte [di], 128
cmp al, -128
cmp cl, -128
cmp byte [di], -128
cmp al, 255
cmp cl, 255
cmp byte [di], 255
cmp ax, cx
cmp bx, ax
cmp cx, [bx]
cmp [bx], bx
cmp cx, [bp]
cmp [bp], bx
cmp cx, [si]
cmp [si], bx
cmp cx, [di]
cmp [di], bx
cmp cx, [bx+si]
cmp [bx+si], bx
cmp cx, [bx+di]
cmp [bx+di], bx
cmp cx, [bp+si]
cmp [bp+si], bx
cmp cx, [bp+di+4]
cmp [bp+di+4], bx
cmp ax, 0
cmp cx, 0
cmp word [di], 0
cmp ax, 1
cmp cx, 1
cmp word [di], 1
cmp ax, -1
cmp cx, -1
cmp word [di], -1
cmp ax, 127
cmp cx, 127
cmp word [di], 127
cmp ax, 128
cmp cx, 128
cmp word [di], 128
cmp ax, -128
cmp cx, -128
cmp word [di], -128
cmp ax, -129
cmp cx, -129
cmp word [di], -129
cmp ax, 255
cmp cx, 255
cmp word [di], 255
cmp ax, 0x1234
cmp cx, 0x1234
cmp word [di], 0x1234
cmp ax, -300
cmp cx, -300
cmp word [di], -300
cmp eax, ecx
cmp ebx, eax
cmp ecx, [bx]
cmp [bx], ebx
cmp ecx, [bp]
cmp [bp], ebx
cmp ecx, [si]
cmp [si], ebx
cmp ecx, [di]
cmp [di], ebx
cmp ecx, [bx+si]
cmp [bx+si], ebx
cmp ecx, [bx+di]
cmp [bx+di], ebx
cmp ecx, [bp+si]
cmp [bp+si], ebx
cmp ecx, [bp+di+4]
cmp [bp+di+4], ebx
cmp eax, 0
cmp ecx, 0
cmp dword [di], 0
cmp eax, 1
cmp ecx, 1
cmp dword [di], 1
cmp eax, -1
cmp ecx, -1
cmp dword [di], -1
cmp eax, 127
cmp ecx, 127
cmp dword [di], 127
cmp eax, 128
cmp ecx, 128
cmp dword [di], 128
cmp eax, -128
cmp ecx, -128
cmp dword [di], -128
cmp eax, -129
cmp ecx, -129
cmp dword [di], -129
cmp eax, 255
cmp ecx, 255
cmp dword [di], 255
cmp eax, 0x1234
cmp ecx, 0x1234
cmp dword [di], 0x1234
cmp eax, -300
cmp ecx, -300
cmp dword [di], -300
cmp al, [dados]
cmp ax, [dados]
cmp eax, [dados]
cmp [dados], al
cmp [dados], eax
mov al, cl
mov dh, al
mov cl, [bx]
mov [bx], dh
mov cl, [bp]
mov [bp], dh
mov cl, [si]
mov [si], dh
mov cl, [di]
mov [di], dh
mov cl, [bx+si]
mov [bx+si], dh
mov cl, [bx+di]
mov [bx+di], dh
mov cl, [bp+si]
mov [bp+si], dh
mov cl, [bp+di+4]
mov [bp+di+4], dh
mov al, 0
mov cl, 0
mov byte [di], 0
mov al, 1
mov cl, 1
mov byte [di], 1
mov al, -1
mov cl, -1
mov byte [di], -1
mov al, 127
mov cl, 127
mov byte [di], 127
mov al, 128
mov cl, 128
mov byte [di], 128
mov al, -128
mov cl, -128
mov byte [di], -128
mov al, 255
mov cl, 255
mov byte [di], 255
mov ax, cx
mov bx, ax
mov cx, [bx]
mov [bx], bx
mov cx, [bp]
mov [bp], bx
mov cx, [si]
mov [si], bx
mov cx, [di]
mov [di], bx
mov cx, [bx+si]
mov [bx+si], bx
mov cx, [bx+di]
mov [bx+di], bx
mov cx, [bp+si]
mov [bp+si], bx
mov cx, [bp+di+4]
mov [bp+di+4], bx
mov ax, 0
mov cx, 0
mov word [di], 0
mov ax, 1
mov cx, 1
mov word [di], 1
mov ax, -1
mov cx, -1
mov word [di], -1
mov ax, 127
mov cx, 127
mov word [di], 127
mov ax, 128
mov cx, 128
mov word [di], 128
mov ax, -128
mov cx, -128
mov word [di], -128
mov ax, -129
mov cx, -129
mov word [di], -129
mov ax, 255
mov cx, 255
mov word [di], 255
mov ax, 0x1234
mov cx, 0x1234
mov word [di], 0x1234
mov ax, -300
mov cx, -300
mov word [di], -300
mov eax, ecx
mov ebx, eax
mov ecx, [bx]
mov [bx], ebx
mov ecx, [bp]
mov [bp], ebx
mov ecx, [si]
mov [si], ebx
mov ecx, [di]
mov [di], ebx
mov ecx, [bx+si]
mov [bx+si], ebx
mov ecx, [bx+di]
mov [bx+di], ebx
mov ecx, [bp+si]
mov [bp+si], ebx
mov ecx, [bp+di+4]
mov [bp+di+4], ebx
mov eax, 0
mov ecx, 0
mov dword [di], 0
mov eax, 1
mov ecx, 1
mov dword [di], 1
mov eax, -1
mov ecx, -1
mov dword [di], -1
mov eax, 127
mov ecx, 127
mov dword [di], 127
mov eax, 128
mov ecx, 128
mov dword [di], 128
mov eax, -128
mov ecx, -128
mov dword [di], -128
mov eax, -129
mov ecx, -129
mov dword [di], -129
mov eax, 255
mov ecx, 255
mov dword [di], 255
mov eax, 0x1234
mov ecx, 0x1234
mov dword [di], 0x1234
mov eax, -300
mov ecx, -300
mov dword [di], -300
mov al, [dados]
mov ax, [dados]
mov eax, [dados]
mov [dados], al
mov [dados], eax
test al, cl
test dh, al
test cl, [bx]
test [bx], dh
test cl, [bp]
test [bp], dh
test cl, [si]
test [si], dh
test cl, [di]
test [di], dh
test cl, [bx+si]
test [bx+si], dh
test cl, [bx+di]
test [bx+di], dh
test cl, [bp+si]
test [bp+si], dh
test cl, [bp+di+4]
test [bp+di+4], dh
test al, 0
test cl, 0
test byte [di], 0
test al, 1
test cl, 1
test byte [di], 1
test al, -1
test cl, -1
test byte [di], -1
test al, 127
test cl, 127
test byte [di], 127
test al, 128
test cl, 128
test byte [di], 128
test al, -128
test cl, -128
test byte [di], -128
test al, 255
test cl, 255
test byte [di], 255
test ax, cx
test bx, ax
test cx, [bx]
test [bx], bx
test cx, [bp]
test [bp], bx
test cx, [si]
test [si], bx
test cx, [di]
test [di], bx
test cx, [bx+si]
test [bx+si], bx
test cx, [bx+di]
test [bx+di], bx
test cx, [bp+si]
test [bp+si], bx
test cx, [bp+di+4]
test [bp+di+4], bx
test ax, 0
test cx, 0
test word [di], 0
test ax, 1
test cx, 1
test word [di], 1
test ax, -1
test cx, -1
test word [di], -1
test ax, 127
test cx, 127
test word [di], 127
test ax, 128
test cx, 128
test word [di], 128
test ax, -128
test cx, -128
test word [di], -128
test ax, -129
test cx, -129
test word [di], -129
test ax, 255
test cx, 255
test word [di], 255
test ax, 0x1234
test cx, 0x1234
test word [di], 0x1234
test ax, -300
test cx, -300
test word [di], -300
test eax, ecx
test ebx, eax
test ecx, [bx]
test [bx], ebx
test ecx, [bp]
test [bp], ebx
test ecx, [si]
test [si], ebx
test ecx, [di]
test [di], ebx
test ecx, [bx+si]
test [bx+si], ebx
test ecx, [bx+di]
test [bx+di], ebx
test ecx, [bp+si]
test [bp+si], ebx
test ecx, [bp+di+4]
test [bp+di+4], ebx
test eax, 0
test ecx, 0
test dword [di], 0
test eax, 1
test ecx, 1
test dword [di], 1
test eax, -1
test ecx, -1
test dword [di], -1
test eax, 127
test ecx, 127
test dword [di], 127
test eax, 128
test ecx, 128
test dword [di], 128
test eax, -128
test ecx, -128
test dword [di], -128
test eax, -129
test ecx, -129
test dword [di], -129
test eax, 255
test ecx, 255
test dword [di], 255
test eax, 0x1234
test ecx, 0x1234
test dword [di], 0x1234
test eax, -300
test ecx, -300
test dword [di], -300
test al, [dados]
test ax, [dados]
test eax, [dados]
test [dados], al
test [dados], eax
lea ax, [bx]
lea eax, [bx]
mov [dados], ax
mov dword [bx], 7
lea ax, [bp]
lea eax, [bp]
mov [dados], ax
mov dword [bp], 7
lea ax, [si]
lea eax, [si]
mov [dados], ax
mov dword [si], 7
lea ax, [di]
lea eax, [di]
mov [dados], ax
mov dword [di], 7
lea ax, [bx+si]
lea eax, [bx+si]
mov [dados], ax
mov dword [bx+si], 7
lea ax, [bx+di]
lea eax, [bx+di]
mov [dados], ax
mov dword [bx+di], 7
lea ax, [bp+si]
lea eax, [bp+si]
mov [dados], ax
mov dword [bp+si], 7
lea ax, [bp+di+4]
lea eax, [bp+di+4]
mov [dados], ax
mov dword [bp+di+4], 7
lea ax, [bx+127]
lea eax, [bx+127]
mov [dados], ax
mov dword [bx+127], 7
lea ax, [bx+128]
lea eax, [bx+128]
mov [dados], ax
mov dword [bx+128], 7
lea ax, [bp-128]
lea eax, [bp-128]
mov [dados], ax
mov dword [bp-128], 7
lea ax, [bp-129]
lea eax, [bp-129]
mov [dados], ax
mov dword [bp-129], 7
lea ax, [si+0x1234]
lea eax, [si+0x1234]
mov [dados], ax
mov dword [si+0x1234], 7
lea ax, [0x1234]
lea eax, [0x1234]
mov [dados], ax
mov dword [0x1234], 7
lea ax, [es:bx]
lea eax, [es:bx]
mov [dados], ax
mov dword [es:bx], 7
lea ax, [cs:0x10]
lea eax, [cs:0x10]
mov [dados], ax
mov dword [cs:0x10], 7
lea ax, [ss:bp+2]
lea eax, [ss:bp+2]
mov [dados], ax
mov dword [ss:bp+2], 7
lea ax, [dados]
lea eax, [dados]
mov [dados], ax
mov dword [dados], 7
lea ax, [dados+bx]
lea eax, [dados+bx]
mov [dados], ax
mov dword [dados+bx], 7
lea ax, [eax]
lea eax, [eax]
mov [dados], ax
mov dword [eax], 7
lea ax, [ebx+ecx*4]
lea eax, [ebx+ecx*4]
mov [dados], ax
mov dword [ebx+ecx*4], 7
mov ax, es
mov eax, es
mov [dados], es
push es
mov es, ax
mov es, [dados]
pop es
mov ax, cs
mov eax, cs
mov [dados], cs
push cs
mov ax, ss
mov eax, ss
mov [dados], ss
push ss
mov ss, ax
mov ss, [dados]
pop ss
mov ax, ds
mov eax, ds
mov [dados], ds
push ds
mov ds, ax
mov ds, [dados]
pop ds
mov ax, fs
mov eax, fs
mov [dados], fs
push fs
mov fs, ax
mov fs, [dados]
pop fs
mov ax, gs
mov eax, gs
mov [dados], gs
push gs
mov gs, ax
mov gs, [dados]
pop gs
mov eax, cr0
mov cr0, ebx
mov eax, cr2
mov cr2, ebx
mov eax, cr3
mov cr3, ebx
mov eax, dr7
mov dr0, ecx
inc al
inc bh
inc cx
inc si
inc eax
inc edi
inc byte [dados]
inc word [bx]
inc dword [ebx+4]
dec al
dec bh
dec cx
dec si
dec eax
dec edi
dec byte [dados]
dec word [bx]
dec dword [ebx+4]
not al
not bh
not cx
not si
not eax
not edi
not byte [dados]
not word [bx]
not dword [ebx+4]
neg al
neg bh
neg cx
neg si
neg eax
neg edi
neg byte [dados]
neg word [bx]
neg dword [ebx+4]
mul al
mul bh
mul cx
mul si
mul eax
mul edi
mul byte [dados]
mul word [bx]
mul dword [ebx+4]
div al
div bh
div cx
div si
div eax
div edi
div byte [dados]
div word [bx]
div dword [ebx+4]
idiv al
idiv bh
idiv cx
idiv si
idiv eax
idiv edi
idiv byte [dados]
idiv word [bx]
idiv dword [ebx+4]
imul al
imul bh
imul cx
imul si
imul eax
imul edi
imul byte [dados]
imul word [bx]
imul dword [ebx+4]
imul ax, bx
imul eax, [dados]
imul cx, dx, 5
imul cx, dx, 500
imul eax, 10
imul esi, [ebx], -3
rol al, 1
rol bx, cl
rol ecx, 4
rol word [dados], 1
rol byte [bx], cl
rol dword [eax], 31
ror al, 1
ror bx, cl
ror ecx, 4
ror word [dados], 1
ror byte [bx], cl
ror dword [eax], 31
rcl al, 1
rcl bx, cl
rcl ecx, 4
rcl word [dados], 1
rcl byte [bx], cl
rcl dword [eax], 31
rcr al, 1
rcr bx, cl
rcr ecx, 4
rcr word [dados], 1
rcr byte [bx], cl
rcr dword [eax], 31
shl al, 1
shl bx, cl
shl ecx, 4
shl word [dados], 1
shl byte [bx], cl
shl dword [eax], 31
sal al, 1
sal bx, cl
sal ecx, 4
sal word [dados], 1
sal byte [bx], cl
sal dword [eax], 31
shr al, 1
shr bx, cl
shr ecx, 4
shr word [dados], 1
shr byte [bx], cl
shr dword [eax], 31
sar al, 1
sar bx, cl
sar ecx, 4
sar word [dados], 1
sar byte [bx], cl
sar dword [eax], 31
shld ax, bx, 4
shrd eax, edx, cl
shld [dados], ecx, 1
bt ax, bx
bt eax, 5
bt dword [dados], ecx
bt word [bx], 3
bts ax, bx
bts eax, 5
bts dword [dados], ecx
bts word [bx], 3
btr ax, bx
btr eax, 5
btr dword [dados], ecx
btr word [bx], 3
btc ax, bx
btc eax, 5
btc dword [dados], ecx
btc word [bx], 3
bsf ax, bx
bsr eax, [dados]
movzx ax, bl
movzx eax, bx
movzx eax, byte [dados]
movzx ecx, word [ebx]
movsx ax, al
movsx edx, word [si]
seto al
seto byte [dados]
setno al
setno byte [dados]
setb al
setb byte [dados]
setae al
setae byte [dados]
sete al
sete byte [dados]
setne al
setne byte [dados]
setbe al
setbe byte [dados]
seta al
seta byte [dados]
sets al
sets byte [dados]
setns al
setns byte [dados]
setp al
setp byte [dados]
setnp al
setnp byte [dados]
setl al
setl byte [dados]
setge al
setge byte [dados]
setle al
setle byte [dados]
setg al
setg byte [dados]
setc al
setc byte [dados]
setz al
setz byte [dados]
setnz al
setnz byte [dados]
push ax
pop ax
push bx
pop bx
push eax
pop eax
push ebp
pop ebp
push word [dados]
push dword [dados]
pop word [bx]
pop dword [eax]
push 0
push word 0
push dword 0
push 5
push word 5
push dword 5
push -5
push word -5
push dword -5
push 127
push word 127
push dword 127
push 128
push word 128
push dword 128
push 0x1234
push word 0x1234
push dword 0x1234
push -1
push word -1
push dword -1
push dados
pusha
popa
pushad
popad
pushaw
popaw
pushf
popf
pushfd
popfd
iret
iretd
iretw
leave
clts
cbw
cwde
cwd
cdq
nop
hlt
cli
sti
cld
std
clc
stc
cmc
lahf
sahf
int3
into
xlatb
aaa
aas
daa
das
aam
aad
cpuid
wbinvd
invd
movsb
rep movsb
movsw
rep movsw
movsd
rep movsd
cmpsb
rep cmpsb
cmpsw
rep cmpsw
cmpsd
rep cmpsd
stosb
rep stosb
stosw
rep stosw
stosd
rep stosd
lodsb
rep lodsb
lodsw
rep lodsw
lodsd
rep lodsd
scasb
rep scasb
scasw
rep scasw
scasd
rep scasd
insb
rep insb
insw
rep insw
insd
rep insd
outsb
rep outsb
outsw
rep outsw
outsd
rep outsd
repne scasb
repe cmpsw
xchg ax, bx
xchg bx, ax
xchg cx, dx
xchg al, ah
xchg eax, esi
xchg [dados], bx
xchg ecx, [ebx]
lds si, [dados]
les di, [bx]
lss esp, [dados]
lfs ax, [dados]
lgs ebx, [eax]
enter 16, 0
enter 8, 1
bound ax, [dados]
bound eax, [ebx]
in al, 0x60
in ax, dx
in eax, dx
out 0x20, al
out dx, ax
out dx, eax
int 0x10
int 3
ret
ret 4
retf
retf 8
lgdt [dados]
lidt [ebx]
sgdt [dados]
sidt [bx]
lmsw ax
smsw ax
smsw [dados]
lldt ax
sldt [dados]
ltr bx
str ax
verr ax
verw [dados]
lar ax, bx
lsl eax, [dados]
arpl [dados], ax
invlpg [eax]
bswap eax
cmpxchg [dados], ecx
xadd al, bl
jmp 0x08:0x1000
jmp dword 0x08:0x12345
call 0x1000:0x20
jmp ax
jmp eax
jmp [dados]
jmp word [bx]
jmp dword [ebx]
call bx
call [dados]
call far [dados]
jmp far [bx]
alvo16:
loop alvo16
loope alvo16
loopne alvo16
jcxz alvo16
jecxz alvo16
jmp short alvo16
jo alvo16
jo longe16
jo near alvo16
jb alvo16
jb longe16
jb near alvo16
je alvo16
je longe16
je near alvo16
jne alvo16
jne longe16
jne near alvo16
ja alvo16
ja longe16
ja near alvo16
jl alvo16
jl longe16
jl near alvo16
jg alvo16
jg longe16
jg near alvo16
jz alvo16
jz longe16
jz near alvo16
jc alvo16
jc longe16
jc near alvo16
jmp alvo16
jmp longe16
jmp near alvo16
call alvo16
call longe16
times 200 nop
longe16:
jmp $
jmp $+2
jnz $-10
bits 32
cpu 586
add al, cl
add dh, al
add cl, [eax]
add [eax], dh
add cl, [ebp]
add [ebp], dh
add cl, [esp]
add [esp], dh
add cl, [esp+4]
add [esp+4], dh
add cl, [ebp-4]
add [ebp-4], dh
add cl, [eax+ecx]
add [eax+ecx], dh
add cl, [eax+esp]
add [eax+esp], dh
add cl, [ebx+ecx*2]
add [ebx+ecx*2], dh
add al, 0
add cl, 0
add byte [esp+4], 0
add al, 1
add cl, 1
add byte [esp+4], 1
add al, -1
add cl, -1
add byte [esp+4], -1
add al, 127
add cl, 127
add byte [esp+4], 127
add al, 128
add cl, 128
add byte [esp+4], 128
add al, -128
add cl, -128
add byte [esp+4], -128
add al, 255
add cl, 255
add byte [esp+4], 255
add ax, cx
add bx, ax
add cx, [eax]
add [eax], bx
add cx, [ebp]
add [ebp], bx
add cx, [esp]
add [esp], bx
add cx, [esp+4]
add [esp+4], bx
add cx, [ebp-4]
add [ebp-4], bx
add cx, [eax+ecx]
add [eax+ecx], bx
add cx, [eax+esp]
add [eax+esp], bx
add cx, [ebx+ecx*2]
add [ebx+ecx*2], bx
add ax, 0
add cx, 0
add word [esp+4], 0
add ax, 1
add cx, 1
add word [esp+4], 1
add ax, -1
add cx, -1
add word [esp+4], -1
add ax, 127
add cx, 127
add word [esp+4], 127
add ax, 128
add cx, 128
add word [esp+4], 128
add ax, -128
add cx, -128
add word [esp+4], -128
add ax, -129
add cx, -129
add word [esp+4], -129
add ax, 255
add cx, 255
add word [esp+4], 255
add ax, 0x1234
add cx, 0x1234
add word [esp+4], 0x1234
add ax, -300
add cx, -300
add word [esp+4], -300
add eax, ecx
add ebx, eax
add ecx, [eax]
add [eax], ebx
add ecx, [ebp]
add [ebp], ebx
add ecx, [esp]
add [esp], ebx
add ecx, [esp+4]
add [esp+4], ebx
add ecx, [ebp-4]
add [ebp-4], ebx
add ecx, [eax+ecx]
add [eax+ecx], ebx
add ecx, [eax+esp]
add [eax+esp], ebx
add ecx, [ebx+ecx*2]
add [ebx+ecx*2], ebx
add eax, 0
add ecx, 0
add dword [esp+4], 0
add eax, 1
add ecx, 1
add dword [esp+4], 1
add eax, -1
add ecx, -1
add dword [esp+4], -1
add eax, 127
add ecx, 127
add dword [esp+4], 127
add eax, 128
add ecx, 128
add dword [esp+4], 128
add eax, -128
add ecx, -128
add dword [esp+4], -128
add eax, -129
add ecx, -129
add dword [esp+4], -129
add eax, 255
add ecx, 255
add dword [esp+4], 255
add eax, 0x1234
add ecx, 0x1234
add dword [esp+4], 0x1234
add eax, -300
add ecx, -300
add dword [esp+4], -300
add al, [dados]
add ax, [dados]
add eax, [dados]
add [dados], al
add [dados], eax
or al, cl
or dh, al
or cl, [eax]
or [eax], dh
or cl, [ebp]
or [ebp], dh
or cl, [esp]
or [esp], dh
or cl, [esp+4]
or [esp+4], dh
or cl, [ebp-4]
or [ebp-4], dh
or cl, [eax+ecx]
or [eax+ecx], dh
or cl, [eax+esp]
or [eax+esp], dh
or cl, [ebx+ecx*2]
or [ebx+ecx*2], dh
or al, 0
or cl, 0
or byte [esp+4], 0
or al, 1
or cl, 1
or byte [esp+4], 1
or al, -1
or cl, -1
or byte [esp+4], -1
or al, 127
or cl, 127
or byte [esp+4], 127
or al, 128
or cl, 128
or byte [esp+4], 128
or al, -128
or cl, -128
or byte [esp+4], -128
or al, 255
or cl, 255
or byte [esp+4], 255
or ax, cx
or bx, ax
or cx, [eax]
or [eax], bx
or cx, [ebp]
or [ebp], bx
or cx, [esp]
or [esp], bx
or cx, [esp+4]
or [esp+4], bx
or cx, [ebp-4]
or [ebp-4], bx
or cx, [eax+ecx]
or [eax+ecx], bx
or cx, [eax+esp]
or [eax+esp], bx
or cx, [ebx+ecx*2]
or [ebx+ecx*2], bx
or ax, 0
or cx, 0
or word [esp+4], 0
or ax, 1
or cx, 1
or word [esp+4], 1
or ax, -1
or cx, -1
or word [esp+4], -1
or ax, 127
or cx, 127
or word [esp+4], 127
or ax, 128
or cx, 128
or word [esp+4], 128
or ax, -128
or cx, -128
or word [esp+4], -128
or ax, -129
or cx, -129
or word [esp+4], -129
or ax, 255
or cx, 255
or word [esp+4], 255
or ax, 0x1234
or cx, 0x1234
or word [esp+4], 0x1234
or ax, -300
or cx, -300
or word [esp+4], -300
or eax, ecx
or ebx, eax
or ecx, [eax]
or [eax], ebx
or ecx, [ebp]
or [ebp], ebx
or ecx, [esp]
or [esp], ebx
or ecx, [esp+4]
or [esp+4], ebx
or ecx, [ebp-4]
or [ebp-4], ebx
or ecx, [eax+ecx]
or [eax+ecx], ebx
or ecx, [eax+esp]
or [eax+esp], ebx
or ecx, [ebx+ecx*2]
or [ebx+ecx*2], ebx
or eax, 0
or ecx, 0
or dword [esp+4], 0
or eax, 1
or ecx, 1
or dword [esp+4], 1
or eax, -1
or ecx, -1
or dword [esp+4], -1
or eax, 127
or ecx, 127
or dword [esp+4], 127
or eax, 128
or ecx, 128
or dword [esp+4], 128
or eax, -128
or ecx, -128
or dword [esp+4], -128
or eax, -129
or ecx, -129
or dword [esp+4], -129
or eax, 255
or ecx, 255
or dword [esp+4], 255
or eax, 0x1234
or ecx, 0x1234
or dword [esp+4], 0x1234
or eax, -300
or ecx, -300
or dword [esp+4], -300
or al, [dados]
or ax, [dados]
or eax, [dados]
or [dados], al
or [dados], eax
adc al, cl
adc dh, al
adc cl, [eax]
adc [eax], dh
adc cl, [ebp]
adc [ebp], dh
adc cl, [esp]
adc [esp], dh
adc cl, [esp+4]
adc [esp+4], dh
adc cl, [ebp-4]
adc [ebp-4], dh
adc cl, [eax+ecx]
adc [eax+ecx], dh
adc cl, [eax+esp]
adc [eax+esp], dh
adc cl, [ebx+ecx*2]
adc [ebx+ecx*2], dh
adc al, 0
adc cl, 0
adc byte [esp+4], 0
adc al, 1
adc cl, 1
adc byte [esp+4], 1
adc al, -1
adc cl, -1
adc byte [esp+4], -1
adc al, 127
adc cl, 127
adc byte [esp+4], 127
adc al, 128
adc cl, 128
adc byte [esp+4], 128
adc al, -128
adc cl, -128
adc byte [esp+4], -128
adc al, 255
adc cl, 255
adc byte [esp+4], 255
adc ax, cx
adc bx, ax
adc cx, [eax]
adc [eax], bx
adc cx, [ebp]
adc [ebp], bx
adc cx, [esp]
adc [esp], bx
adc cx, [esp+4]
adc [esp+4], bx
adc cx, [ebp-4]
adc [ebp-4], bx
adc cx, [eax+ecx]
adc [eax+ecx], bx
adc cx, [eax+esp]
adc [eax+esp], bx
adc cx, [ebx+ecx*2]
adc [ebx+ecx*2], bx
adc ax, 0
adc cx, 0
adc word [esp+4], 0
adc ax, 1
adc cx, 1
adc word [esp+4], 1
adc ax, -1
adc cx, -1
adc word [esp+4], -1
adc ax, 127
adc cx, 127
adc word [esp+4], 127
adc ax, 128
adc cx, 128
adc word [esp+4], 128
adc ax, -128
adc cx, -128
adc word [esp+4], -128
adc ax, -129
adc cx, -129
adc word [esp+4], -129
adc ax, 255
adc cx, 255
adc word [esp+4], 255
adc ax, 0x1234
adc cx, 0x1234
adc word [esp+4], 0x1234
adc ax, -300
adc cx, -300
adc word [esp+4], -300
adc eax, ecx
adc ebx, eax
adc ecx, [eax]
adc [eax], ebx
adc ecx, [ebp]
adc [ebp], ebx
adc ecx, [esp]
adc [esp], ebx
adc ecx, [esp+4]
adc [esp+4], ebx
adc ecx, [ebp-4]
adc [ebp-4], ebx
adc ecx, [eax+ecx]
adc [eax+ecx], ebx
adc ecx, [eax+esp]
adc [eax+esp], ebx
adc ecx, [ebx+ecx*2]
adc [ebx+ecx*2], ebx
adc eax, 0
adc ecx, 0
adc dword [esp+4], 0
adc eax, 1
adc ecx, 1
adc dword [esp+4], 1
adc eax, -1
adc ecx, -1
adc dword [esp+4], -1
adc eax, 127
adc ecx, 127
adc dword [esp+4], 127
adc eax, 128
adc ecx, 128
adc dword [esp+4], 128
adc eax, -128
adc ecx, -128
adc dword [esp+4], -128
adc eax, -129
adc ecx, -129
adc dword [esp+4], -129
adc eax, 255
adc ecx, 255
adc dword [esp+4], 255
adc eax, 0x1234
adc ecx, 0x1234
adc dword [esp+4], 0x1234
adc eax, -300
adc ecx, -300
adc dword [esp+4], -300
adc al, [dados]
adc ax, [dados]
adc eax, [dados]
adc [dados], al
adc [dados], eax
sbb al, cl
sbb dh, al
sbb cl, [eax]
sbb [eax], dh
sbb cl, [ebp]
sbb [ebp], dh
sbb cl, [esp]
sbb [esp], dh
sbb cl, [esp+4]
sbb [esp+4], dh
sbb cl, [ebp-4]
sbb [ebp-4], dh
sbb cl, [eax+ecx]
sbb [eax+ecx], dh
sbb cl, [eax+esp]
sbb [eax+esp], dh
sbb cl, [ebx+ecx*2]
sbb [ebx+ecx*2], dh
sbb al, 0
sbb cl, 0
sbb byte [esp+4], 0
sbb al, 1
sbb cl, 1
sbb byte [esp+4], 1
sbb al, -1
sbb cl, -1
sbb byte [esp+4], -1
sbb al, 127
sbb cl, 127
sbb byte [esp+4], 127
sbb al, 128
sbb cl, 128
sbb byte [esp+4], 128
sbb al, -128
sbb cl, -128
sbb byte [esp+4], -128
sbb al, 255
sbb cl, 255
sbb byte [esp+4], 255
sbb ax, cx
sbb bx, ax
sbb cx, [eax]
sbb [eax], bx
sbb cx, [ebp]
sbb [ebp], bx
sbb cx, [esp]
sbb [esp], bx
sbb cx, [esp+4]
sbb [esp+4], bx
sbb cx, [ebp-4]
sbb [ebp-4], bx
sbb cx, [eax+ecx]
sbb [eax+ecx], bx
sbb cx, [eax+esp]
sbb [eax+esp], bx
sbb cx, [ebx+ecx*2]
sbb [ebx+ecx*2], bx
sbb ax, 0
sbb cx, 0
sbb word [esp+4], 0
sbb ax, 1
sbb cx, 1
sbb word [esp+4], 1
sbb ax, -1
sbb cx, -1
sbb word [esp+4], -1
sbb ax, 127
sbb cx, 127
sbb word [esp+4], 127
sbb ax, 128
sbb cx, 128
sbb word [esp+4], 128
sbb ax, -128
sbb cx, -128
sbb word [esp+4], -128
sbb ax, -129
sbb cx, -129
sbb word [esp+4], -129
sbb ax, 255
sbb cx, 255
sbb word [esp+4], 255
sbb ax, 0x1234
sbb cx, 0x1234
sbb word [esp+4], 0x1234
sbb ax, -300
sbb cx, -300
sbb word [esp+4], -300
sbb eax, ecx
sbb ebx, eax
sbb ecx, [eax]
sbb [eax], ebx
sbb ecx, [ebp]
sbb [ebp], ebx
sbb ecx, [esp]
sbb [esp], ebx
sbb ecx, [esp+4]
sbb [esp+4], ebx
sbb ecx, [ebp-4]
sbb [ebp-4], ebx
sbb ecx, [eax+ecx]
sbb [eax+ecx], ebx
sbb ecx, [eax+esp]
sbb [eax+esp], ebx
sbb ecx, [ebx+ecx*2]
sbb [ebx+ecx*2], ebx
sbb eax, 0
sbb ecx, 0
sbb dword [esp+4], 0
sbb eax, 1
sbb ecx, 1
sbb dword [esp+4], 1
sbb eax, -1
sbb ecx, -1
sbb dword [esp+4], -1
sbb eax, 127
sbb ecx, 127
sbb dword [esp+4], 127
sbb eax, 128
sbb ecx, 128
sbb dword [esp+4], 128
sbb eax, -128
sbb ecx, -128
sbb dword [esp+4], -128
sbb eax, -129
sbb ecx, -129
sbb dword [esp+4], -129
sbb eax, 255
sbb ecx, 255
sbb dword [esp+4], 255
sbb eax, 0x1234
sbb ecx, 0x1234
sbb dword [esp+4], 0x1234
sbb eax, -300
sbb ecx, -300
sbb dword [esp+4], -300
sbb al, [dados]
sbb ax, [dados]
sbb eax, [dados]
sbb [dados], al
sbb [dados], eax
and al, cl
and dh, al
and cl, [eax]
and [eax], dh
and cl, [ebp]
and [ebp], dh
and cl, [esp]
and [esp], dh
and cl, [esp+4]
and [esp+4], dh
and cl, [ebp-4]
and [ebp-4], dh
and cl, [eax+ecx]
and [eax+ecx], dh
and cl, [eax+esp]
and [eax+esp], dh
and cl, [ebx+ecx*2]
and [ebx+ecx*2], dh
and al, 0
and cl, 0
and byte [esp+4], 0
and al, 1
and cl, 1
and byte [esp+4], 1
and al, -1
and cl, -1
and byte [esp+4], -1
and al, 127
and cl, 127
and byte [esp+4], 127
and al, 128
and cl, 128
and byte [esp+4], 128
and al, -128
and cl, -128
and byte [esp+4], -128
and al, 255
and cl, 255
and byte [esp+4], 255
and ax, cx
and bx, ax
and cx, [eax]
and [eax], bx
and cx, [ebp]
and [ebp], bx
and cx, [esp]
and [esp], bx
and cx, [esp+4]
and [esp+4], bx
and cx, [ebp-4]
and [ebp-4], bx
and cx, [eax+ecx]
and [eax+ecx], bx
and cx, [eax+esp]
and [eax+esp], bx
and cx, [ebx+ecx*2]
and [ebx+ecx*2], bx
and ax, 0
and cx, 0
and word [esp+4], 0
and ax, 1
and cx, 1
and word [esp+4], 1
and ax, -1
and cx, -1
and word [esp+4], -1
and ax, 127
and cx, 127
and word [esp+4], 127
and ax, 128
and cx, 128
and word [esp+4], 128
and ax, -128
and cx, -128
and word [esp+4], -128
and ax, -129
and cx, -129
and word [esp+4], -129
and ax, 255
and cx, 255
and word [esp+4], 255
and ax, 0x1234
and cx, 0x1234
and word [esp+4], 0x1234
and ax, -300
and cx, -300
and word [esp+4], -300
and eax, ecx
and ebx, eax
and ecx, [eax]
and [eax], ebx
and ecx, [ebp]
and [ebp], ebx
and ecx, [esp]
and [esp], ebx
and ecx, [esp+4]
and [esp+4], ebx
and ecx, [ebp-4]
and [ebp-4], ebx
and ecx, [eax+ecx]
and [eax+ecx], ebx
and ecx, [eax+esp]
and [eax+esp], ebx
and ecx, [ebx+ecx*2]
and [ebx+ecx*2], ebx
and eax, 0
and ecx, 0
and dword [esp+4], 0
and eax, 1
and ecx, 1
and dword [esp+4], 1
and eax, -1
and ecx, -1
and dword [esp+4], -1
and eax, 127
and ecx, 127
and dword [esp+4], 127
and eax, 128
and ecx, 128
and dword [esp+4], 128
and eax, -128
and ecx, -128
and dword [esp+4], -128
and eax, -129
and ecx, -129
and dword [esp+4], -129
and eax, 255
and ecx, 255
and dword [esp+4], 255
and eax, 0x1234
and ecx, 0x1234
and dword [esp+4], 0x1234
and eax, -300
and ecx, -300
and dword [esp+4], -300
and al, [dados]
and ax, [dados]
and eax, [dados]
and [dados], al
and [dados], eax
sub al, cl
sub dh, al
sub cl, [eax]
sub [eax], dh
sub cl, [ebp]
sub [ebp], dh
sub cl, [esp]
sub [esp], dh
sub cl, [esp+4]
sub [esp+4], dh
sub cl, [ebp-4]
sub [ebp-4], dh
sub cl, [eax+ecx]
sub [eax+ecx], dh
sub cl, [eax+esp]
sub [eax+esp], dh
sub cl, [ebx+ecx*2]
sub [ebx+ecx*2], dh
sub al, 0
sub cl, 0
sub byte [esp+4], 0
sub al, 1
sub cl, 1
sub byte [esp+4], 1
sub al, -1
sub cl, -1
sub byte [esp+4], -1
sub al, 127
sub cl, 127
sub byte [esp+4], 127
sub al, 128
sub cl, 128
sub byte [esp+4], 128
sub al, -128
sub cl, -128
sub byte [esp+4], -128
sub al, 255
sub cl, 255
sub byte [esp+4], 255
sub ax, cx
sub bx, ax
sub cx, [eax]
sub [eax], bx
sub cx, [ebp]
sub [ebp], bx
sub cx, [esp]
sub [esp], bx
sub cx, [esp+4]
sub [esp+4], bx
sub cx, [ebp-4]
sub [ebp-4], bx
sub cx, [eax+ecx]
sub [eax+ecx], bx
sub cx, [eax+esp]
sub [eax+esp], bx
sub cx, [ebx+ecx*2]
sub [ebx+ecx*2], bx
sub ax, 0
sub cx, 0
sub word [esp+4], 0
sub ax, 1
sub cx, 1
sub word [esp+4], 1
sub ax, -1
sub cx, -1
sub word [esp+4], -1
sub ax, 127
sub cx, 127
sub word [esp+4], 127
sub ax, 128
sub cx, 128
sub word [esp+4], 128
sub ax, -128
sub cx, -128
sub word [esp+4], -128
sub ax, -129
sub cx, -129
sub word [esp+4], -129
sub ax, 255
sub cx, 255
sub word [esp+4], 255
sub ax, 0x1234
sub cx, 0x1234
sub word [esp+4], 0x1234
sub ax, -300
sub cx, -300
sub word [esp+4], -300
sub eax, ecx
sub ebx, eax
sub ecx, [eax]
sub [eax], ebx
sub ecx, [ebp]
sub [ebp], ebx
sub ecx, [esp]
sub [esp], ebx
sub ecx, [esp+4]
sub [esp+4], ebx
sub ecx, [ebp-4]
sub [ebp-4], ebx
sub ecx, [eax+ecx]
sub [eax+ecx], ebx
sub ecx, [eax+esp]
sub [eax+esp], ebx
sub ecx, [ebx+ecx*2]
sub [ebx+ecx*2], ebx
sub eax, 0
sub ecx, 0
sub dword [esp+4], 0
sub eax, 1
sub ecx, 1
sub dword [esp+4], 1
sub eax, -1
sub ecx, -1
sub dword [esp+4], -1
sub eax, 127
sub ecx, 127
sub dword [esp+4], 127
sub eax, 128
sub ecx, 128
sub dword [esp+4], 128
sub eax, -128
sub ecx, -128
sub dword [esp+4], -128
sub eax, -129
sub ecx, -129
sub dword [esp+4], -129
sub eax, 255
sub ecx, 255
sub dword [esp+4], 255
sub eax, 0x1234
sub ecx, 0x1234
sub dword [esp+4], 0x1234
sub eax, -300
sub ecx, -300
sub dword [esp+4], -300
sub al, [dados]
sub ax, [dados]
sub eax, [dados]
sub [dados], al
sub [dados], eax
xor al, cl
xor dh, al
xor cl, [eax]
xor [eax], dh
xor cl, [ebp]
xor [ebp], dh
xor cl, [esp]
xor [esp], dh
xor cl, [esp+4]
xor [esp+4], dh
xor cl, [ebp-4]
xor [ebp-4], dh
xor cl, [eax+ecx]
xor [eax+ecx], dh
xor cl, [eax+esp]
xor [eax+esp], dh
xor cl, [ebx+ecx*2]
xor [ebx+ecx*2], dh
xor al, 0
xor cl, 0
xor byte [esp+4], 0
xor al, 1
xor cl, 1
xor byte [esp+4], 1
xor al, -1
xor cl, -1
xor byte [esp+4], -1
xor al, 127
xor cl, 127
xor byte [esp+4], 127
xor al, 128
xor cl, 128
xor byte [esp+4], 128
xor al, -128
xor cl, -128
xor byte [esp+4], -128
xor al, 255
xor cl, 255
xor byte [esp+4], 255
xor ax, cx
xor bx, ax
xor cx, [eax]
xor [eax], bx
xor cx, [ebp]
xor [ebp], bx
xor cx, [esp]
xor [esp], bx
xor cx, [esp+4]
xor [esp+4], bx
xor cx, [ebp-4]
xor [ebp-4], bx
xor cx, [eax+ecx]
xor [eax+ecx], bx
xor cx, [eax+esp]
xor [eax+esp], bx
xor cx, [ebx+ecx*2]
xor [ebx+ecx*2], bx
xor ax, 0
xor cx, 0
xor word [esp+4], 0
xor ax, 1
xor cx, 1
xor word [esp+4], 1
xor ax, -1
xor cx, -1
xor word [esp+4], -1
xor ax, 127
xor cx, 127
xor word [esp+4], 127
xor ax, 128
xor cx, 128
xor word [esp+4], 128
xor ax, -128
xor cx, -128
xor word [esp+4], -128
xor ax, -129
xor cx, -129
xor word [esp+4], -129
xor ax, 255
xor cx, 255
xor word [esp+4], 255
xor ax, 0x1234
xor cx, 0x1234
xor word [esp+4], 0x1234
xor ax, -300
xor cx, -300
xor word [esp+4], -300
xor eax, ecx
xor ebx, eax
xor ecx, [eax]
xor [eax], ebx
xor ecx, [ebp]
xor [ebp], ebx
xor ecx, [esp]
xor [esp], ebx
xor ecx, [esp+4]
xor [esp+4], ebx
xor ecx, [ebp-4]
xor [ebp-4], ebx
xor ecx, [eax+ecx]
xor [eax+ecx], ebx
xor ecx, [eax+esp]
xor [eax+esp], ebx
xor ecx, [ebx+ecx*2]
xor [ebx+ecx*2], ebx
xor eax, 0
xor ecx, 0
xor dword [esp+4], 0
xor eax, 1
xor ecx, 1
xor dword [esp+4], 1
xor eax, -1
xor ecx, -1
xor dword [esp+4], -1
xor eax, 127
xor ecx, 127
xor dword [esp+4], 127
xor eax, 128
xor ecx, 128
xor dword [esp+4], 128
xor eax, -128
xor ecx, -128
xor dword [esp+4], -128
xor eax, -129
xor ecx, -129
xor dword [esp+4], -129
xor eax, 255
xor ecx, 255
xor dword [esp+4], 255
xor eax, 0x1234
xor ecx, 0x1234
xor dword [esp+4], 0x1234
xor eax, -300
xor ecx, -300
xor dword [esp+4], -300
xor al, [dados]
xor ax, [dados]
xor eax, [dados]
xor [dados], al
xor [dados], eax
cmp al, cl
cmp dh, al
cmp cl, [eax]
cmp [eax], dh
cmp cl, [ebp]
cmp [ebp], dh
cmp cl, [esp]
cmp [esp], dh
cmp cl, [esp+4]
cmp [esp+4], dh
cmp cl, [ebp-4]
cmp [ebp-4], dh
cmp cl, [eax+ecx]
cmp [eax+ecx], dh
cmp cl, [eax+esp]
cmp [eax+esp], dh
cmp cl, [ebx+ecx*2]
cmp [ebx+ecx*2], dh
cmp al, 0
cmp cl, 0
cmp byte [esp+4], 0
cmp al, 1
cmp cl, 1
cmp byte [esp+4], 1
cmp al, -1
cmp cl, -1
cmp byte [esp+4], -1
cmp al, 127
cmp cl, 127
cmp byte [esp+4], 127
cmp al, 128
cmp cl, 128
cmp byte [esp+4], 128
cmp al, -128
cmp cl, -128
cmp byte [esp+4], -128
cmp al, 255
cmp cl, 255
cmp byte [esp+4], 255
cmp ax, cx
cmp bx, ax
cmp cx, [eax]
cmp [eax], bx
cmp cx, [ebp]
cmp [ebp], bx
cmp cx, [esp]
cmp [esp], bx
cmp cx, [esp+4]
cmp [esp+4], bx
cmp cx, [ebp-4]
cmp [ebp-4], bx
cmp cx, [eax+ecx]
cmp [eax+ecx], bx
cmp cx, [eax+esp]
cmp [eax+esp], bx
cmp cx, [ebx+ecx*2]
cmp [ebx+ecx*2], bx
cmp ax, 0
cmp cx, 0
cmp word [esp+4], 0
cmp ax, 1
cmp cx, 1
cmp word [esp+4], 1
cmp ax, -1
cmp cx, -1
cmp word [esp+4], -1
cmp ax, 127
cmp cx, 127
cmp word [esp+4], 127
cmp ax, 128
cmp cx, 128
cmp word [esp+4], 128
cmp ax, -128
cmp cx, -128
cmp word [esp+4], -128
cmp ax, -129
cmp cx, -129
cmp word [esp+4], -129
cmp ax, 255
cmp cx, 255
cmp word [esp+4], 255
cmp ax, 0x1234
cmp cx, 0x1234
cmp word [esp+4], 0x1234
cmp ax, -300
cmp cx, -300
cmp word [esp+4], -300
cmp eax, ecx
cmp ebx, eax
cmp ecx, [eax]
cmp [eax], ebx
cmp ecx, [ebp]
cmp [ebp], ebx
cmp ecx, [esp]
cmp [esp], ebx
cmp ecx, [esp+4]
cmp [esp+4], ebx
cmp ecx, [ebp-4]
cmp [ebp-4], ebx
cmp ecx, [eax+ecx]
cmp [eax+ecx], ebx
cmp ecx, [eax+esp]
cmp [eax+esp], ebx
cmp ecx, [ebx+ecx*2]
cmp [ebx+ecx*2], ebx
cmp eax, 0
cmp ecx, 0
cmp dword [esp+4], 0
cmp eax, 1
cmp ecx, 1
cmp dword [esp+4], 1
cmp eax, -1
cmp ecx, -1
cmp dword [esp+4], -1
cmp eax, 127
cmp ecx, 127
cmp dword [esp+4], 127
cmp eax, 128
cmp ecx, 128
cmp dword [esp+4], 128
cmp eax, -128
cmp ecx, -128
cmp dword [esp+4], -128
cmp eax, -129
cmp ecx, -129
cmp dword [esp+4], -129
cmp eax, 255
cmp ecx, 255
cmp dword [esp+4], 255
cmp eax, 0x1234
cmp ecx, 0x1234
cmp dword [esp+4], 0x1234
cmp eax, -300
cmp ecx, -300
cmp dword [esp+4], -300
cmp al, [dados]
cmp ax, [dados]
cmp eax, [dados]
cmp [dados], al
cmp [dados], eax
mov al, cl
mov dh, al
mov cl, [eax]
mov [eax], dh
mov cl, [ebp]
mov [ebp], dh
mov cl, [esp]
mov [esp], dh
mov cl, [esp+4]
mov [esp+4], dh
mov cl, [ebp-4]
mov [ebp-4], dh
mov cl, [eax+ecx]
mov [eax+ecx], dh
mov cl, [eax+esp]
mov [eax+esp], dh
mov cl, [ebx+ecx*2]
mov [ebx+ecx*2], dh
mov al, 0
mov cl, 0
mov byte [esp+4], 0
mov al, 1
mov cl, 1
mov byte [esp+4], 1
mov al, -1
mov cl, -1
mov byte [esp+4], -1
mov al, 127
mov cl, 127
mov byte [esp+4], 127
mov al, 128
mov cl, 128
mov byte [esp+4], 128
mov al, -128
mov cl, -128
mov byte [esp+4], -128
mov al, 255
mov cl, 255
mov byte [esp+4], 255
mov ax, cx
mov bx, ax
mov cx, [eax]
mov [eax], bx
mov cx, [ebp]
mov [ebp], bx
mov cx, [esp]
mov [esp], bx
mov cx, [esp+4]
mov [esp+4], bx
mov cx, [ebp-4]
mov [ebp-4], bx
mov cx, [eax+ecx]
mov [eax+ecx], bx
mov cx, [eax+esp]
mov [eax+esp], bx
mov cx, [ebx+ecx*2]
mov [ebx+ecx*2], bx
mov ax, 0
mov cx, 0
mov word [esp+4], 0
mov ax, 1
mov cx, 1
mov word [esp+4], 1
mov ax, -1
mov cx, -1
mov word [esp+4], -1
mov ax, 127
mov cx, 127
mov word [esp+4], 127
mov ax, 128
mov cx, 128
mov word [esp+4], 128
mov ax, -128
mov cx, -128
mov word [esp+4], -128
mov ax, -129
mov cx, -129
mov word [esp+4], -129
mov ax, 255
mov cx, 255
mov word [esp+4], 255
mov ax, 0x1234
mov cx, 0x1234
mov word [esp+4], 0x1234
mov ax, -300
mov cx, -300
mov word [esp+4], -300
mov eax, ecx
mov ebx, eax
mov ecx, [eax]
mov [eax], ebx
mov ecx, [ebp]
mov [ebp], ebx
mov ecx, [esp]
mov [esp], ebx
mov ecx, [esp+4]
mov [esp+4], ebx
mov ecx, [ebp-4]
mov [ebp-4], ebx
mov ecx, [eax+ecx]
mov [eax+ecx], ebx
mov ecx, [eax+esp]
mov [eax+esp], ebx
mov ecx, [ebx+ecx*2]
mov [ebx+ecx*2], ebx
mov eax, 0
mov ecx, 0
mov dword [esp+4], 0
mov eax, 1
mov ecx, 1
mov dword [esp+4], 1
mov eax, -1
mov ecx, -1
mov dword [esp+4], -1
mov eax, 127
mov ecx, 127
mov dword [esp+4], 127
mov eax, 128
mov ecx, 128
mov dword [esp+4], 128
mov eax, -128
mov ecx, -128
mov dword [esp+4], -128
mov eax, -129
mov ecx, -129
mov dword [esp+4], -129
mov eax, 255
mov ecx, 255
mov dword [esp+4], 255
mov eax, 0x1234
mov ecx, 0x1234
mov dword [esp+4], 0x1234
mov eax, -300
mov ecx, -300
mov dword [esp+4], -300
mov al, [dados]
mov ax, [dados]
mov eax, [dados]
mov [dados], al
mov [dados], eax
test al, cl
test dh, al
test cl, [eax]
test [eax], dh
test cl, [ebp]
test [ebp], dh
test cl, [esp]
test [esp], dh
test cl, [esp+4]
test [esp+4], dh
test cl, [ebp-4]
test [ebp-4], dh
test cl, [eax+ecx]
test [eax+ecx], dh
test cl, [eax+esp]
test [eax+esp], dh
test cl, [ebx+ecx*2]
test [ebx+ecx*2], dh
test al, 0
test cl, 0
test byte [esp+4], 0
test al, 1
test cl, 1
test byte [esp+4], 1
test al, -1
test cl, -1
test byte [esp+4], -1
test al, 127
test cl, 127
test byte [esp+4], 127
test al, 128
test cl, 128
test byte [esp+4], 128
test al, -128
test cl, -128
test byte [esp+4], -128
test al, 255
test cl, 255
test byte [esp+4], 255
test ax, cx
test bx, ax
test cx, [eax]
test [eax], bx
test cx, [ebp]
test [ebp], bx
test cx, [esp]
test [esp], bx
test cx, [esp+4]
test [esp+4], bx
test cx, [ebp-4]
test [ebp-4], bx
test cx, [eax+ecx]
test [eax+ecx], bx
test cx, [eax+esp]
test [eax+esp], bx
test cx, [ebx+ecx*2]
test [ebx+ecx*2], bx
test ax, 0
test cx, 0
test word [esp+4], 0
test ax, 1
test cx, 1
test word [esp+4], 1
test ax, -1
test cx, -1
test word [esp+4], -1
test ax, 127
test cx, 127
test word [esp+4], 127
test ax, 128
test cx, 128
test word [esp+4], 128
test ax, -128
test cx, -128
test word [esp+4], -128
test ax, -129
test cx, -129
test word [esp+4], -129
test ax, 255
test cx, 255
test word [esp+4], 255
test ax, 0x1234
test cx, 0x1234
test word [esp+4], 0x1234
test ax, -300
test cx, -300
test word [esp+4], -300
test eax, ecx
test ebx, eax
test ecx, [eax]
test [eax], ebx
test ecx, [ebp]
test [ebp], ebx
test ecx, [esp]
test [esp], ebx
test ecx, [esp+4]
test [esp+4], ebx
test ecx, [ebp-4]
test [ebp-4], ebx
test ecx, [eax+ecx]
test [eax+ecx], ebx
test ecx, [eax+esp]
test [eax+esp], ebx
test ecx, [ebx+ecx*2]
test [ebx+ecx*2], ebx
test eax, 0
test ecx, 0
test dword [esp+4], 0
test eax, 1
test ecx, 1
test dword [esp+4], 1
test eax, -1
test ecx, -1
test dword [esp+4], -1
test eax, 127
test ecx, 127
test dword [esp+4], 127
test eax, 128
test ecx, 128
test dword [esp+4], 128
test eax, -128
test ecx, -128
test dword [esp+4], -128
test eax, -129
test ecx, -129
test dword [esp+4], -129
test eax, 255
test ecx, 255
test dword [esp+4], 255
test eax, 0x1234
test ecx, 0x1234
test dword [esp+4], 0x1234
test eax, -300
test ecx, -300
test dword [esp+4], -300
test al, [dados]
test ax, [dados]
test eax, [dados]
test [dados], al
test [dados], eax
lea ax, [eax]
lea eax, [eax]
mov [dados], ax
mov dword [eax], 7
lea ax, [ebp]
lea eax, [ebp]
mov [dados], ax
mov dword [ebp], 7
lea ax, [esp]
lea eax, [esp]
mov [dados], ax
mov dword [esp], 7
lea ax, [esp+4]
lea eax, [esp+4]
mov [dados], ax
mov dword [esp+4], 7
lea ax, [ebp-4]
lea eax, [ebp-4]
mov [dados], ax
mov dword [ebp-4], 7
lea ax, [eax+ecx]
lea eax, [eax+ecx]
mov [dados], ax
mov dword [eax+ecx], 7
lea ax, [eax+esp]
lea eax, [eax+esp]
mov [dados], ax
mov dword [eax+esp], 7
lea ax, [ebx+ecx*2]
lea eax, [ebx+ecx*2]
mov [dados], ax
mov dword [ebx+ecx*2], 7
lea ax, [ebx+esi*4+8]
lea eax, [ebx+esi*4+8]
mov [dados], ax
mov dword [ebx+esi*4+8], 7
lea ax, [edi*8+0x100]
lea eax, [edi*8+0x100]
mov [dados], ax
mov dword [edi*8+0x100], 7
lea ax, [ecx*2]
lea eax, [ecx*2]
mov [dados], ax
mov dword [ecx*2], 7
lea ax, [edx*1]
lea eax, [edx*1]
mov [dados], ax
mov dword [edx*1], 7
lea ax, [eax+ebx*8-200]
lea eax, [eax+ebx*8-200]
mov [dados], ax
mov dword [eax+ebx*8-200], 7
lea ax, [ebp+edi*4]
lea eax, [ebp+edi*4]
mov [dados], ax
mov dword [ebp+edi*4], 7
lea ax, [0x12345678]
lea eax, [0x12345678]
mov [dados], ax
mov dword [0x12345678], 7
lea ax, [fs:eax]
lea eax, [fs:eax]
mov [dados], ax
mov dword [fs:eax], 7
lea ax, [gs:0x10]
lea eax, [gs:0x10]
mov [dados], ax
mov dword [gs:0x10], 7
lea ax, [dados]
lea eax, [dados]
mov [dados], ax
mov dword [dados], 7
lea ax, [ebx+dados]
lea eax, [ebx+dados]
mov [dados], ax
mov dword [ebx+dados], 7
lea ax, [esi+1000]
lea eax, [esi+1000]
mov [dados], ax
mov dword [esi+1000], 7
lea ax, [bx]
lea eax, [bx]
mov [dados], ax
mov dword [bx], 7
lea ax, [bp+si+2]
lea eax, [bp+si+2]
mov [dados], ax
mov dword [bp+si+2], 7
mov ax, es
mov eax, es
mov [dados], es
push es
mov es, ax
mov es, [dados]
pop es
mov ax, cs
mov eax, cs
mov [dados], cs
push cs
mov ax, ss
mov eax, ss
mov [dados], ss
push ss
mov ss, ax
mov ss, [dados]
pop ss
mov ax, ds
mov eax, ds
mov [dados], ds
push ds
mov ds, ax
mov ds, [dados]
pop ds
mov ax, fs
mov eax, fs
mov [dados], fs
push fs
mov fs, ax
mov fs, [dados]
pop fs
mov ax, gs
mov eax, gs
mov [dados], gs
push gs
mov gs, ax
mov gs, [dados]
pop gs
mov eax, cr0
mov cr0, ebx
mov eax, cr2
mov cr2, ebx
mov eax, cr3
mov cr3, ebx
mov eax, dr7
mov dr0, ecx
inc al
inc bh
inc cx
inc si
inc eax
inc edi
inc byte [dados]
inc word [bx]
inc dword [ebx+4]
dec al
dec bh
dec cx
dec si
dec eax
dec edi
dec byte [dados]
dec word [bx]
dec dword [ebx+4]
not al
not bh
not cx
not si
not eax
not edi
not byte [dados]
not word [bx]
not dword [ebx+4]
neg al
neg bh
neg cx
neg si
neg eax
neg edi
neg byte [dados]
neg word [bx]
neg dword [ebx+4]
mul al
mul bh
mul cx
mul si
mul eax
mul edi
mul byte [dados]
mul word [bx]
mul dword [ebx+4]
div al
div bh
div cx
div si
div eax
div edi
div byte [dados]
div word [bx]
div dword [ebx+4]
idiv al
idiv bh
idiv cx
idiv si
idiv eax
idiv edi
idiv byte [dados]
idiv word [bx]
idiv dword [ebx+4]
imul al
imul bh
imul cx
imul si
imul eax
imul edi
imul byte [dados]
imul word [bx]
imul dword [ebx+4]
imul ax, bx
imul eax, [dados]
imul cx, dx, 5
imul cx, dx, 500
imul eax, 10
imul esi, [ebx], -3
rol al, 1
rol bx, cl
rol ecx, 4
rol word [dados], 1
rol byte [bx], cl
rol dword [eax], 31
ror al, 1
ror bx, cl
ror ecx, 4
ror word [dados], 1
ror byte [bx], cl
ror dword [eax], 31
rcl al, 1
rcl bx, cl
rcl ecx, 4
rcl word [dados], 1
rcl byte [bx], cl
rcl dword [eax], 31
rcr al, 1
rcr bx, cl
rcr ecx, 4
rcr word [dados], 1
rcr byte [bx], cl
rcr dword [eax], 31
shl al, 1
shl bx, cl
shl ecx, 4
shl word [dados], 1
shl byte [bx], cl
shl dword [eax], 31
sal al, 1
sal bx, cl
sal ecx, 4
sal word [dados], 1
sal byte [bx], cl
sal dword [eax], 31
shr al, 1
shr bx, cl
shr ecx, 4
shr word [dados], 1
shr byte [bx], cl
shr dword [eax], 31
sar al, 1
sar bx, cl
sar ecx, 4
sar word [dados], 1
sar byte [bx], cl
sar dword [eax], 31
shld ax, bx, 4
shrd eax, edx, cl
shld [dados], ecx, 1
bt ax, bx
bt eax, 5
bt dword [dados], ecx
bt word [bx], 3
bts ax, bx
bts eax, 5
bts dword [dados], ecx
bts word [bx], 3
btr ax, bx
btr eax, 5
btr dword [dados], ecx
btr word [bx], 3
btc ax, bx
btc eax, 5
btc dword [dados], ecx
btc word [bx], 3
bsf ax, bx
bsr eax, [dados]
movzx ax, bl
movzx eax, bx
movzx eax, byte [dados]
movzx ecx, word [ebx]
movsx ax, al
movsx edx, word [si]
seto al
seto byte [dados]
setno al
setno byte [dados]
setb al
setb byte [dados]
setae al
setae byte [dados]
sete al
sete byte [dados]
setne al
setne byte [dados]
setbe al
setbe byte [dados]
seta al
seta byte [dados]
sets al
sets byte [dados]
setns al
setns byte [dados]
setp al
setp byte [dados]
setnp al
setnp byte [dados]
setl al
setl byte [dados]
setge al
setge byte [dados]
setle al
setle byte [dados]
setg al
setg byte [dados]
setc al
setc byte [dados]
setz al
setz byte [dados]
setnz al
setnz byte [dados]
push ax
pop ax
push bx
pop bx
push eax
pop eax
push ebp
pop ebp
push word [dados]
push dword [dados]
pop word [bx]
pop dword [eax]
push 0
push word 0
push dword 0
push 5
push word 5
push dword 5
push -5
push word -5
push dword -5
push 127
push word 127
push dword 127
push 128
push word 128
push dword 128
push 0x1234
push word 0x1234
push dword 0x1234
push -1
push word -1
push dword -1
push dados
pusha
popa
pushad
popad
pushaw
popaw
pushf
popf
pushfd
popfd
iret
iretd
iretw
leave
clts
cbw
cwde
cwd
cdq
nop
hlt
cli
sti
cld
std
clc
stc
cmc
lahf
sahf
int3
into
xlatb
aaa
aas
daa
das
aam
aad
cpuid
wbinvd
invd
movsb
rep movsb
movsw
rep movsw
movsd
rep movsd
cmpsb
rep cmpsb
cmpsw
rep cmpsw
cmpsd
rep cmpsd
stosb
rep stosb
stosw
rep stosw
stosd
rep stosd
lodsb
rep lodsb
lodsw
rep lodsw
lodsd
rep lodsd
scasb
rep scasb
scasw
rep scasw
scasd
rep scasd
insb
rep insb
insw
rep insw
insd
rep insd
outsb
rep outsb
outsw
rep outsw
outsd
rep outsd
repne scasb
repe cmpsw
xchg ax, bx
xchg bx, ax
xchg cx, dx
xchg al, ah
xchg eax, esi
xchg [dados], bx
xchg ecx, [ebx]
lds si, [dados]
les di, [bx]
lss esp, [dados]
lfs ax, [dados]
lgs ebx, [eax]
enter 16, 0
enter 8, 1
bound ax, [dados]
bound eax, [ebx]
in al, 0x60
in ax, dx
in eax, dx
out 0x20, al
out dx, ax
out dx, eax
int 0x10
int 3
ret
ret 4
retf
retf 8
lgdt [dados]
lidt [ebx]
sgdt [dados]
sidt [bx]
lmsw ax
smsw ax
smsw [dados]
lldt ax
sldt [dados]
ltr bx
str ax
verr ax
verw [dados]
lar ax, bx
lsl eax, [dados]
arpl [dados], ax
invlpg [eax]
bswap eax
cmpxchg [dados], ecx
xadd al, bl
jmp 0x08:0x1000
jmp dword 0x08:0x12345
call 0x1000:0x20
jmp ax
jmp eax
jmp [dados]
jmp word [bx]
jmp dword [ebx]
call bx
call [dados]
call far [dados]
jmp far [bx]
alvo32:
loop alvo32
loope alvo32
loopne alvo32
jcxz alvo32
jecxz alvo32
jmp short alvo32
jo alvo32
jo longe32
jo near alvo32
jb alvo32
jb longe32
jb near alvo32
je alvo32
je longe32
je near alvo32
jne alvo32
jne longe32
jne near alvo32
ja alvo32
ja longe32
ja near alvo32
jl alvo32
jl longe32
jl near alvo32
jg alvo32
jg longe32
jg near alvo32
jz alvo32
jz longe32
jz near alvo32
jc alvo32
jc longe32
jc near alvo32
jmp alvo32
jmp longe32
jmp near alvo32
call alvo32
call longe32
times 200 nop
longe32:
jmp $
jmp $+2
jnz $-10
dados: dw 0x1234, 5
db 1, 2, "texto", 0, 'x'
dd 0x12345678, dados, dados+4
dw "ab", "c"
dq 0x00CF9A000000FFFF
align 16
align 8, db 0
resb 3
times 4 db 0xAA
meio equ $ - dados
dw meio
struc PONTO
.x: resw 1
.y: resw 1
endstruc
mov ax, PONTO.y
mov ax, PONTO_size
mov ax, [bx+PONTO.y]
%macro somar 2
  add %1, %2
%%aqui: jmp %%aqui
%endmacro
somar ax, 5
somar ebx, ecx
%assign i 0
%rep 4
  db i * 3
%assign i i + 1
%endrep
%define PORTA 0x3F8
mov dx, PORTA + 5
principal:
.laco: dec cx
jnz .laco
outro:
.laco: jmp .laco
jmp principal.laco
; tamanho forçado do deslocamento, prefixo de segmento solto, %+ e parâmetro guloso
bits 16
mov bx, [dword eax]
mov bx, [byte eax]
mov bx, [byte bx]
mov bx, [word bx+4]
mov bx, [dword eax+ecx*2]
mov bx, [byte esp]
mov ax, [dword 0x1234]
mov ax, [word 0x1234]
cs lodsb
es movsw
fs lodsd
bits 32
mov ax, [word 0x1234]
mov ax, [dword ebx+1]
mov ax, [byte ebp]
mov ax, [dword 5]
gs lodsb
%macro texto 1+
  db %1, 0
%endmacro
texto 'a, b', 13, 10
%assign k 3
rot %+ k: dd rot3
