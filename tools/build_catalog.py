#!/usr/bin/env python3
"""Build data/catalog.json and data/illustrations/*.webp from the Model S parts PDF.

Usage:
    pip install pdfplumber pypdf pillow
    python3 tools/build_catalog.py [path/to/model_s_partsGuide.pdf]

The PDF is a Microsoft Reporting Services export with a fixed layout:
  * font size 16 bold  -> system      (top-right, e.g. "BODY")
  * font size 14 bold  -> subsystem   (e.g. "BODY PANELS")
  * font size 12 bold  -> group       (e.g. "Body Side Panels")
  * one exploded-view illustration per group, followed by a ruled table
    (No / Part Name / Category / Part Description / Part Number / Qty / Comments)
Rows are frequently repeated (one copy per model-year column in the source
report), so exact duplicates are removed per group.
"""
import io
import json
import os
import re
import sys
from collections import OrderedDict

import pdfplumber
import pypdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PDF = os.path.join(ROOT, 'model_s_partsGuide-NA-2012-2016.pdf')
OUT_JSON = os.path.join(ROOT, 'data', 'catalog.json')
OUT_IMG = os.path.join(ROOT, 'data', 'illustrations')

SYSTEM_KO = {
    'BATTERY SYSTEM': '배터리 시스템',
    'BODY': '차체',
    'BRAKES': '브레이크',
    'CHASSIS': '섀시',
    'CLOSURES COMPONENTS': '개폐장치 부품',
    'ELECTRICAL': '전장',
    'EXTERIOR FITTINGS': '외장 부품',
    'EXTERNAL CHARGING SYSTEMS': '외부 충전 장비',
    'FRONT DRIVE UNIT': '프론트 구동 유닛',
    'HIGH VOLTAGE SYSTEM': '고전압 시스템',
    'INFOTAINMENT': '인포테인먼트',
    'INSTRUMENT PANEL': '인스트루먼트 패널',
    'INTERIOR TRIM': '실내 트림',
    'LABELS': '라벨',
    'OWNER INFORMATION': '오너 정보',
    'REAR DRIVE UNIT': '리어 구동 유닛',
    'ROOF': '루프',
    'SAFETY AND RESTRAINT': '안전 및 구속장치',
    'SEATS': '시트',
    'STEERING': '스티어링',
    'SUSPENSION': '서스펜션',
    'THERMAL MANAGEMENT': '열관리',
    'WHEELS AND TIRES': '휠 및 타이어',
}

SUBSYSTEM_KO = {
    'BATTERY ASSEMBLY': '배터리 어셈블리',
    'BODY PANELS': '차체 패널',
    'BUMPER AND FASCIA': '범퍼 및 페시아',
    'WINDSHIELD, LIFTGATE GLASS, AND BODY GLASS': '윈드실드·리프트게이트·차체 유리',
    'ABS, TRACTION AND STABILITY CONTROL': 'ABS·트랙션·차체자세 제어',
    'BRAKE DISCS AND CALIPERS': '브레이크 디스크 및 캘리퍼',
    'BRAKE PEDAL': '브레이크 페달',
    'BRAKE PIPES AND HOSES': '브레이크 파이프 및 호스',
    'ELECTROMECHANICAL BRAKE BOOSTER': '전기기계식 브레이크 부스터',
    'PARKING BRAKE': '주차 브레이크',
    'VACUUM BRAKE BOOSTER': '진공 브레이크 부스터',
    'CHASSIS AND SUBFRAMES': '섀시 및 서브프레임',
    'CLOSURE ASSIST MECHANISM AND HINGES': '개폐 보조장치 및 힌지',
    'DOOR GLASS REGULATORS': '도어 유리 레귤레이터',
    'EXTERIOR DOOR HANDLES': '외부 도어 핸들',
    'INTERIOR DOOR HANDLES': '실내 도어 핸들',
    'LATCHES, STRIKERS, AND PINCH SENSORS': '래치·스트라이커·끼임 센서',
    'LIFTGATE': '리프트게이트',
    'SEALS BODY CLOSURES': '개폐부 실(Seal)',
    '12V BATTERY AND FUSES': '12V 배터리 및 퓨즈',
    'ACCELERATOR PEDAL': '가속 페달',
    'ELECTRONIC CONTROL MODULES': '전자 제어 모듈',
    'EXTERIOR LIGHTS': '외부 조명',
    'FRONT CAMERA': '전방 카메라',
    'HARNESSES': '하네스(배선)',
    'HORN': '경음기',
    'INTERIOR LIGHTING': '실내 조명',
    'INTERIOR SWITCHES': '실내 스위치',
    'KEYLESS ENTRY AND SECURITY': '키리스 엔트리 및 보안',
    'PARKING SENSORS': '주차 센서',
    'RADAR SENSORS': '레이더 센서',
    'REAR CAMERA': '후방 카메라',
    'WIPERS AND WASHERS': '와이퍼 및 워셔',
    'BADGES AND FILMS': '배지 및 필름',
    'EXTERIOR MIRRORS': '외부 미러',
    'EXTERIOR TRIM': '외부 트림',
    'LICENSE PLATE MOUNTING': '번호판 장착',
    'UNDERHOOD TRIM': '후드 내부 트림',
    'UNDERTRAY AND DIFFUSER': '언더트레이 및 디퓨저',
    'WHEEL ARCH LINERS': '휠 아치 라이너',
    'EXTERNAL CHARGING SYSTEMS': '외부 충전 장비',
    'Front Drive Unit Assembly': '프론트 구동 유닛 어셈블리',
    'GEARBOX AND HALFSHAFTS': '기어박스 및 하프샤프트',
    'CHARGE SYSTEM INLET': '충전 인렛',
    'DC-DC CONVERTER': 'DC-DC 컨버터',
    'ONBOARD CHARGER': '차량 탑재 충전기',
    'ANTENNA - AM FM HD RADIO': '안테나 - AM/FM HD 라디오',
    'ANTENNA - GPS': '안테나 - GPS',
    'ANTENNA - GSM': '안테나 - GSM',
    'ANTENNA - SATELLITE RADIO': '안테나 - 위성 라디오',
    'ANTENNA - WI-FI': '안테나 - Wi-Fi',
    'AUDIO SYSTEM - AM FM HD RADIO': '오디오 - AM/FM HD 라디오',
    'AUDIO SYSTEM - BLUETOOTH': '오디오 - 블루투스',
    'AUDIO SYSTEM - SPEAKERS, SUBWOOFER AND AMPLIFIER': '오디오 - 스피커·서브우퍼·앰프',
    'AUDIO SYSTEM - USB MEDIA PORT': '오디오 - USB 미디어 포트',
    'DISPLAYS': '디스플레이',
    'MEDIA CONTROL UNIT (TOUCH SCREEN)': '미디어 컨트롤 유닛(터치스크린)',
    'INSTRUMENT PANEL': '인스트루먼트 패널',
    'CARPETING AND MATS': '카펫 및 매트',
    'CENTER CONSOLE': '센터 콘솔',
    'DOOR TRIM': '도어 트림',
    'HEADLINER': '헤드라이너',
    'INTERIOR MIRROR AND SUN VISORS': '실내 미러 및 선바이저',
    'INTERIOR TRIM': '실내 트림',
    'LUGGAGE COMPARTMENT TRIM': '적재함 트림',
    'LABELS': '라벨',
    'OWNER INFORMATION': '오너 정보',
    'Rear Drive Unit Assembly': '리어 구동 유닛 어셈블리',
    'PANORAMIC ROOF': '파노라믹 루프',
    'AIR BAGS': '에어백',
    'PRE-TENSIONERS': '프리텐셔너',
    'SEAT BELTS': '안전벨트',
    'SENSORS': '센서',
    '1301 - Front Seat Tracks and Motors': '1301 - 앞좌석 레일 및 모터',
    '1304 - Front Seat Assemblies and Hardware': '1304 - 앞좌석 어셈블리 및 하드웨어',
    '1305 - 2nd Row Seat Assemblies and Hardware': '1305 - 2열 시트 어셈블리 및 하드웨어',
    '1306 - 3rd Row Seat Assemblies and Hardware': '1306 - 3열 시트 어셈블리 및 하드웨어',
    '1307 - Front Seat Covers and Pads and Trims': '1307 - 앞좌석 커버·패드·트림',
    'STEERING RACK AND LOWER COLUMN': '스티어링 랙 및 하부 칼럼',
    'Upper Column and Steering Wheel': '상부 칼럼 및 스티어링 휠',
    'AIR SUSPENSION SYSTEM': '에어 서스펜션 시스템',
    'FRONT SUSPENSION (INCLUDING HUBS)': '프론트 서스펜션(허브 포함)',
    'REAR SUSPENSION (INCLUDING HUBS)': '리어 서스펜션(허브 포함)',
    'AIR DISTRIBUTION': '공기 분배',
    'CABIN HVAC': '실내 공조(HVAC)',
    'COOLANT SYSTEM': '냉각수 시스템',
    'REFRIGERANT SYSTEM': '냉매 시스템',
    'TIRE PRESSURE MONITORING SYSTEM (TPMS)': '타이어 공기압 감지(TPMS)',
    'TIRES': '타이어',
    'WHEELS': '휠',
}

GROUP_KO = {
    'High Voltage Battery Assembly': '고전압 배터리 어셈블리',
    'Body Side Panels': '보디 사이드 패널',
    'Closure Panels': '개폐 패널(후드·도어·리프트게이트)',
    'Front Fenders': '프론트 펜더',
    'Front Inner Panels - Dual Motor': '프론트 인너 패널 - 듀얼 모터',
    'Front Inner Panels - Rear Wheel Drive': '프론트 인너 패널 - 후륜구동',
    'NVH Damping and Paint Armor': 'NVH 댐핑 및 페인트 보호재',
    'Rear End Panels': '리어 엔드 패널',
    'Rear Quarter Inner Panels': '리어 쿼터 인너 패널',
    'Rocker Panel Trim': '로커 패널 트림',
    'Roof Panels': '루프 패널',
    'Sill Components': '사이드 실 부품',
    'Structural Repair Consumables': '구조 수리 소모품',
    'Front Bumper (Fascia) Carrier - Dual Motor': '프론트 범퍼(페시아) 캐리어 - 듀얼 모터',
    'Front Bumper (Fascia) Carrier - Single Motor': '프론트 범퍼(페시아) 캐리어 - 싱글 모터',
    'Front Bumper Fascia': '프론트 범퍼 페시아',
    'Front Energy Absorber': '프론트 충격 흡수재(범퍼 빔)',
    'Front Grille and Applique': '프론트 그릴 및 아플리케',
    'Rear Bumper Fascia': '리어 범퍼 페시아',
    'Rear Energy Absorber': '리어 충격 흡수재(범퍼 빔)',
    'Front and Rear Door Glass': '앞·뒤 도어 유리',
    'Windshield and Liftgate Glass': '윈드실드 및 리프트게이트 유리',
    'ABS Module and ESC Sensor': 'ABS 모듈 및 ESC 센서',
    'Wheel Speed Sensors': '휠 속도 센서',
    'Front Brake Rotors - Calipers and Pads': '프론트 브레이크 로터·캘리퍼·패드',
    'Rear Brake Rotors - Calipers and Pads': '리어 브레이크 로터·캘리퍼·패드',
    'Brake Pedal': '브레이크 페달',
    'Brake Lines': '브레이크 라인',
    'Jounce Hoses': '브레이크 바운스(자운스) 호스',
    'Electromechanical Brake Booster': '전기기계식 브레이크 부스터(iBooster)',
    'Park Brake Calipers and Pads': '주차 브레이크 캘리퍼 및 패드',
    'Brake Master Cylinder': '브레이크 마스터 실린더',
    'Brake Vacuum Pump and Booster': '브레이크 진공 펌프 및 부스터',
    'Front Subframe': '프론트 서브프레임',
    'Front Subframe - Dual Motor': '프론트 서브프레임 - 듀얼 모터',
    'Rear Subframe': '리어 서브프레임',
    'Door Controllers and Sensors': '도어 컨트롤러 및 센서',
    'Front Door Hinges and Fittings': '앞 도어 힌지 및 부속',
    'Hood Hinges and Fittings': '후드 힌지 및 부속',
    'Liftgate Hinges and Fittings': '리프트게이트 힌지 및 부속',
    'Rear Door Hinges and Fittings': '뒤 도어 힌지 및 부속',
    'Front and Rear Door Glass Regulator': '앞·뒤 도어 유리 레귤레이터',
    'Front Exterior Door Handle': '앞 외부 도어 핸들',
    'Rear Exterior Door Handle': '뒤 외부 도어 핸들',
    'Front Door Latch and Interior Release': '앞 도어 래치 및 실내 릴리스',
    'Rear Door Latch and Interior Release': '뒤 도어 래치 및 실내 릴리스',
    'Dual Hood Latch and Release': '듀얼 후드 래치 및 릴리스',
    'Front Door Latch and Striker': '앞 도어 래치 및 스트라이커',
    'Liftgate Handle and Emergency Release': '리프트게이트 핸들 및 비상 해제',
    'Liftgate Latch': '리프트게이트 래치',
    'Rear Door Latch and Striker': '뒤 도어 래치 및 스트라이커',
    'Single Hood Latch and Release': '싱글 후드 래치 및 릴리스',
    'Liftgate Drain': '리프트게이트 배수',
    'Front Door Seals': '앞 도어 실',
    'Hood Seals': '후드 실',
    'Rear Door Seals': '뒤 도어 실',
    'Trunk Lid Seal': '트렁크(리프트게이트) 실',
    '12V Battery and Fittings': '12V 배터리 및 부속',
    'Relays and Fuses': '릴레이 및 퓨즈',
    'Accelerator Pedal': '가속 페달',
    'Body Controllers': '보디 컨트롤러',
    'Front Lights (Excluding Headlamps)': '전면 램프(헤드램프 제외)',
    'Headlamps': '헤드램프',
    'Tail Lights': '테일 램프',
    'Forward Facing Camera': '전방 카메라',
    'Cabin Harness': '캐빈 하네스',
    'Dash and Console Harnesses': '대시 및 콘솔 하네스',
    'Doors and Liftgate Harnesses': '도어 및 리프트게이트 하네스',
    'Front End and Front Bumper Harness': '프론트 엔드 및 앞 범퍼 하네스',
    'Main (Lower Dash) and Motor Bay Harnesses': '메인(하부 대시) 및 모터룸 하네스',
    'Panoramic Roof and Head Lining Harness': '파노라믹 루프 및 헤드라이닝 하네스',
    'Rear Bumper and Subframe Harness': '뒤 범퍼 및 서브프레임 하네스',
    'Horns': '경음기(혼)',
    'Dome Lights': '실내등',
    'Switches': '스위치',
    'Key Fob': '키 포브',
    'Remote and Passive Entry': '원격 및 패시브 엔트리',
    'Module - Park Assist': '주차 보조 모듈',
    'Parking Sensors - Driver Assist': '주차 센서 - 드라이버 어시스트',
    'Parking Sensors - Park Assist': '주차 센서 - 파크 어시스트',
    'Radar Sensors': '레이더 센서',
    'Rear View Camera': '후방 카메라',
    'Windshield Washer Bottle and Pump': '워셔액 탱크 및 펌프',
    'Windshield Washer Nozzle and Tubing': '워셔 노즐 및 튜브',
    'Windshield Wipers and Motor': '와이퍼 및 모터',
    'Badges': '배지(엠블럼)',
    'Exterior Mirrors': '외부 미러',
    'Exterior Trim Fittings': '외부 트림 부속',
    'License Plate Mounting - China': '번호판 장착 - 중국',
    'License Plate Mounting - Europe': '번호판 장착 - 유럽',
    'License Plate Mounting - Japan and Australia': '번호판 장착 - 일본·호주',
    'License Plate Mounting - North America': '번호판 장착 - 북미',
    'Underhood Trim': '후드 내부 트림(에이프런)',
    'Front Undertray': '프론트 언더트레이',
    'Rear Undertray and Diffuser': '리어 언더트레이 및 디퓨저',
    'Motor Bay Absorber': '모터룸 흡음재',
    'Wheel Arch Liners': '휠 아치 라이너',
    'External Charging Systems': '외부 충전 장비',
    'Motor': '모터',
    'Halfshafts': '하프샤프트',
    'Charge Port': '충전 포트',
    'High Voltage Cables - 1st Generation': '고전압 케이블 - 1세대',
    'High Voltage Cables - 2nd Generation': '고전압 케이블 - 2세대',
    'DC-DC Converter - 1st Generation': 'DC-DC 컨버터 - 1세대',
    'DC-DC Converter - 2nd Generation': 'DC-DC 컨버터 - 2세대',
    'Onboard Charger': '차량 탑재 충전기',
    'AM FM Antennas and Amplifiers': 'AM/FM 안테나 및 앰프',
    'GPS Antenna': 'GPS 안테나',
    'GSM Antenna': 'GSM 안테나',
    'Satellite Radio - Antenna': '위성 라디오 안테나',
    'WI-FI Antenna': 'Wi-Fi 안테나',
    'Radio': '라디오',
    'Bluetooth and Microphones': '블루투스 및 마이크',
    'Audio Speakers - Base': '오디오 스피커 - 기본',
    'Audio Speakers - Premium': '오디오 스피커 - 프리미엄',
    'USB Hubs and Brackets': 'USB 허브 및 브래킷',
    'Instrument Cluster': '계기판(인스트루먼트 클러스터)',
    'Touchscreen': '터치스크린(MCU)',
    'Dash Panel': '대시 패널',
    'Dash Support Frame': '대시 지지 프레임',
    'Interior Ducting and Vents': '실내 덕트 및 송풍구',
    'Interior Sound Insulation': '실내 방음재',
    'Passenger Compartment Carpet': '실내 카펫',
    'Trunk Carpet and Side Finishers': '트렁크 카펫 및 사이드 마감재',
    'Center Tunnel Trim': '센터 터널 트림',
    'Premium Console Insert': '프리미엄 콘솔 인서트',
    'Front Door Trim Pad': '앞 도어 트림 패드',
    'Rear Door Trim Pad': '뒤 도어 트림 패드',
    'Headlining': '헤드라이닝',
    'Rearview Mirror': '룸미러',
    'Sun Visor': '선바이저',
    'A - B and C Post Interior Trim': 'A·B·C 필러 실내 트림',
    'Interior Trunk Trim Panels': '트렁크 실내 트림 패널',
    'Liftgate Interior Trim': '리프트게이트 실내 트림',
    'Parcel Shelf': '파셀 선반',
    'Front Luggage Storage Compartment': '프렁크(앞 적재함)',
    'Front Luggage Storage Compartment Carpet Lining': '프렁크 카펫 라이닝',
    'Labels': '라벨',
    'Labels - HV Battery': '라벨 - 고전압 배터리',
    'In-Car Information': '차량 비치 자료',
    'Motor - Large Rear Drive Unit': '모터 - 대형 리어 구동 유닛',
    'Motor - Small Rear Drive Unit': '모터 - 소형 리어 구동 유닛',
    'Roof Glass': '루프 글라스',
    'Drive Motor and Cable Mechanism': '구동 모터 및 케이블 기구',
    'Panoramic Roof Assembly': '파노라믹 루프 어셈블리',
    'Panoramic Roof Fittings and Finishers': '파노라믹 루프 부속 및 마감재',
    'Panoramic Roof Frame and Drain Tubes': '파노라믹 루프 프레임 및 배수관',
    'Roof Seals and Anti-Pinch Sensors': '루프 실 및 끼임 방지 센서',
    'Shades and Wind Deflector': '차양 및 윈드 디플렉터',
    'Front Air Bags': '전면 에어백',
    'Side Air Bags': '측면 에어백',
    'Pre-Tensioners': '프리텐셔너',
    '2nd Row Seat Belts': '2열 안전벨트',
    '3rd Row Seat Belts': '3열 안전벨트',
    'Front Seat Belts': '앞좌석 안전벨트',
    'Impact and Acceleration Sensors - EU and APAC': '충돌·가속도 센서 - 유럽·아태',
    'Impact and Acceleration Sensors - NA': '충돌·가속도 센서 - 북미',
    'Passenger Presence Detection': '탑승자 감지(PODS)',
    'Front Seat Control Switches': '앞좌석 조절 스위치',
    'Front Seat Slides Motors and Controllers': '앞좌석 슬라이드·모터·컨트롤러',
    'Front Seat Assemblies - Base Trim': '앞좌석 어셈블리 - 베이스 트림',
    'Front Seat Assemblies - Performance Trim': '앞좌석 어셈블리 - 퍼포먼스 트림',
    'Front Seat Assemblies - Premium Trim': '앞좌석 어셈블리 - 프리미엄 트림',
    'Front Seat Assemblies - Signature Trim': '앞좌석 어셈블리 - 시그니처 트림',
    '2nd Row Seat Assemblies - Base Trim': '2열 시트 어셈블리 - 베이스 트림',
    '2nd Row Seat Assemblies - Performance Trim': '2열 시트 어셈블리 - 퍼포먼스 트림',
    '2nd Row Seat Assemblies - Premium Trim': '2열 시트 어셈블리 - 프리미엄 트림',
    '2nd Row Seat Assemblies - Signature Trim': '2열 시트 어셈블리 - 시그니처 트림',
    '2nd Row Seat Frame': '2열 시트 프레임',
    '3rd Row Seats': '3열 시트',
    'Front Seat Covers and Pads - Base Trim': '앞좌석 커버·패드 - 베이스 트림',
    'Front Seat Covers and Pads - Next Generation Trim': '앞좌석 커버·패드 - 넥스트 제너레이션 트림',
    'Front Seat Covers and Pads - Performance Trim': '앞좌석 커버·패드 - 퍼포먼스 트림',
    'Front Seat Covers and Pads - Premium Trim': '앞좌석 커버·패드 - 프리미엄 트림',
    'Front Seat Covers and Pads - Signature Trim': '앞좌석 커버·패드 - 시그니처 트림',
    'Steering Gear and Lower Column': '스티어링 기어 및 하부 칼럼',
    'Steering Column and Wheel': '스티어링 칼럼 및 휠',
    'Air Suspension Compressor and Reservoir': '에어 서스펜션 컴프레서 및 리저버',
    'Front Air Suspension Pressure Lines': '프론트 에어 서스펜션 압력 라인',
    'Height Sensors': '차고 센서',
    'Module - Air Suspension': '에어 서스펜션 모듈',
    'Rear Air Suspension Pressure Lines': '리어 에어 서스펜션 압력 라인',
    'Front Air Spring': '프론트 에어 스프링',
    'Front Coil Spring and Damper': '프론트 코일 스프링 및 댐퍼',
    'Front Knuckle - Hub and Bearing': '프론트 너클·허브·베어링',
    'Front Stabilizer Bar and Links': '프론트 스태빌라이저 바 및 링크',
    'Front Suspension Arms': '프론트 서스펜션 암',
    'Rear Air Spring': '리어 에어 스프링',
    'Rear Coil Spring and Damper': '리어 코일 스프링 및 댐퍼',
    'Rear Knuckle - Hub and Bearing': '리어 너클·허브·베어링',
    'Rear Stabilizer Bar and Links': '리어 스태빌라이저 바 및 링크',
    'Rear Suspension Arms': '리어 서스펜션 암',
    'Coolant Reservoir': '냉각수 리저버',
    'Cooling System Air Ducting': '냉각 시스템 공기 덕트',
    'Radiator': '라디에이터',
    'Blower Motor': '블로어 모터',
    'Heater Assembly and Pollen Filter': '히터 어셈블리 및 에어컨 필터',
    'Heater Core': '히터 코어(PTC)',
    'Heating and Ventilation Actuators (Motors)': '공조 액추에이터(모터)',
    'Heating and Ventilation Controllers': '공조 컨트롤러',
    'Battery Cooling': '배터리 냉각',
    'Battery Cooling - 2nd Generation': '배터리 냉각 - 2세대',
    'Battery Cooling - Dual Motor': '배터리 냉각 - 듀얼 모터',
    'Motor Cooling - Dual Motor - Large Rear Drive Unit': '모터 냉각 - 듀얼 모터 - 대형 리어 구동 유닛',
    'Motor Cooling - Dual Motor - Small Rear Drive Unit': '모터 냉각 - 듀얼 모터 - 소형 리어 구동 유닛',
    'Motor Cooling - RWD': '모터 냉각 - 후륜구동',
    'Air Conditioning Condenser': '에어컨 콘덴서',
    'Air Conditioning Pipes and Hoses': '에어컨 파이프 및 호스',
    'Compressor': '에어컨 컴프레서',
    'Tire Pressure Monitoring System (TPMS)': '타이어 공기압 감지 시스템(TPMS)',
    'Tires': '타이어',
    'Wheels': '휠',
}

# Group names that are too generic on their own get the system id as prefix.
AMBIGUOUS_GROUP_NAMES = {'Motor', 'Halfshafts'}

CATEGORY_NOTES = {
    'Restricted': '구조(접착·리벳·용접) 부품, 에어백(SRS), 고전압 관련 부품. VIN 필요, 승인된 바디샵에만 판매.',
    'Unrestricted': '제한/OTC 외의 부품. VIN 필요, 지원 차량에 한해 고객·제3자 판매 가능.',
    'OTC': '와이퍼 블레이드·브레이크 패드 등 소모품. VIN 불필요, 누구에게나 판매 가능.',
}


def slugify(text):
    s = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return s


def cluster_lines(words, tol=2.0):
    lines = []
    for w in sorted(words, key=lambda w: (round(w['top']), w['x0'])):
        for line in lines:
            if abs(line['top'] - w['top']) < tol and abs(line['size'] - w['size']) < 0.5:
                line['words'].append(w)
                break
        else:
            lines.append({'top': w['top'], 'size': w['size'], 'words': [w]})
    for line in lines:
        line['text'] = ' '.join(w['text'] for w in sorted(line['words'], key=lambda w: w['x0']))
    return lines


def clean(cell):
    return re.sub(r'\s*\n\s*', ' ', (cell or '').strip()).strip()


_SIDE_L = re.compile(r'\b(LH|LEFT|LT|LHS|L/H|LF|LR)\b|\(LH\)|\d0/LH')
_SIDE_R = re.compile(r'\b(RH|RIGHT|RT|RHS|R/H|RF)\b|\(RH\)|\d0/RH')
_END_F = re.compile(r'\b(FR|FRONT|FRT|FNT|LF|RF|1ST ROW)\b')
_END_R = re.compile(r'\b(RR|REAR|LR)\b')


def position_tags(name, desc):
    """Return a compact tag string ('L', 'R', 'F', 'B' letters) for a part.

    L/R = left/right hand side, F/B = front/rear.  Ambiguous mentions such as
    "LH/RH" or "FRT / RR" produce no tag for that axis.
    """
    text = (name + ' | ' + desc).upper()
    tags = ''
    left, right = bool(_SIDE_L.search(text)), bool(_SIDE_R.search(text))
    if left != right:
        tags += 'L' if left else 'R'
    front, rear = bool(_END_F.search(text)), bool(_END_R.search(text))
    if front != rear:
        tags += 'F' if front else 'B'
    return tags


def parse(pdf_path):
    events = []
    with pdfplumber.open(pdf_path) as pdf:
        for pi, page in enumerate(pdf.pages):
            pn = pi + 1
            words = page.extract_words(extra_attrs=['fontname', 'size'])
            heads = [w for w in words if 'Bold' in w['fontname'] and w['size'] >= 11.5]
            for line in cluster_lines(heads):
                kind = {16: 'system', 14: 'subsystem', 12: 'group'}.get(round(line['size']))
                if kind:
                    events.append((pn, line['top'], 0, kind, line['text']))
            for im in page.images:
                if im['width'] > 50 and im['height'] > 50:
                    events.append((pn, im['top'], 1, 'image', None))
            for table in page.find_tables():
                events.append((pn, table.bbox[1], 1, 'table', table.extract()))
            if pn % 50 == 0:
                print(f'  parsed page {pn}/{len(pdf.pages)}', file=sys.stderr)
    events.sort(key=lambda e: (e[0], e[1], e[2]))

    systems = []
    cur_sys = cur_sub = cur_grp = None
    for pn, _top, _o, kind, payload in events:
        if kind == 'system':
            if cur_sys is None or cur_sys['name'] != payload:
                cur_sys = {'name': payload, 'subsystems': []}
                systems.append(cur_sys)
                cur_sub = cur_grp = None
        elif kind == 'subsystem':
            cur_sub = {'name': payload, 'groups': []}
            cur_sys['subsystems'].append(cur_sub)
            cur_grp = None
        elif kind == 'group':
            if cur_sub is None:
                cur_sub = {'name': cur_sys['name'], 'groups': []}
                cur_sys['subsystems'].append(cur_sub)
            cur_grp = {'name': payload, 'pages': [pn], 'imagePages': [], 'parts': [], '_seen': set()}
            cur_sub['groups'].append(cur_grp)
        elif kind == 'image' and cur_grp is not None:
            cur_grp['imagePages'].append(pn)
        elif kind == 'table' and cur_grp is not None:
            if pn not in cur_grp['pages']:
                cur_grp['pages'].append(pn)
            for row in payload:
                if not row or len(row) < 7:
                    continue
                row = [clean(c) for c in row[:7]]
                if row[0] == 'No' and row[1] == 'Part Name':
                    continue
                if not any(row):
                    continue
                key = tuple(row)
                if key in cur_grp['_seen']:
                    continue
                cur_grp['_seen'].add(key)
                no, name, cat, desc, pnum, qty, com = row
                part = OrderedDict(no=no, pn=pnum, name=name, desc=desc, qty=qty, cat=cat, cmt=com, pg=pn)
                tags = position_tags(name, desc)
                if tags:
                    part['tags'] = tags
                cur_grp['parts'].append(part)
    # Drop the introductory pages ("Parts Categories", "Using the Parts Manual").
    return [s for s in systems if any(g['parts'] for sub in s['subsystems'] for g in sub['groups'])]


def extract_images(pdf_path, groups_by_page):
    os.makedirs(OUT_IMG, exist_ok=True)
    reader = pypdf.PdfReader(pdf_path)
    written = {}
    for pn, gid in groups_by_page.items():
        page = reader.pages[pn - 1]
        for idx, im in enumerate(page.images):
            img = im.image
            if img.width < 50 or img.height < 50:
                continue
            fname = f'{gid}.webp' if gid not in written else f'{gid}-{len(written[gid]) + 1}.webp'
            img.convert('RGB').save(os.path.join(OUT_IMG, fname), format='WEBP', quality=80, method=6)
            written.setdefault(gid, []).append({'file': f'illustrations/{fname}', 'page': pn,
                                                'w': img.width, 'h': img.height})
    return written


def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    print(f'Parsing {pdf_path}', file=sys.stderr)
    systems = parse(pdf_path)

    used_ids = set()
    groups_by_page = {}
    out_systems = []
    total_parts = 0
    pns = set()
    for s in systems:
        sid = slugify(s['name'])
        so = OrderedDict(id=sid, name=s['name'], nameKo=SYSTEM_KO.get(s['name'], s['name']), subsystems=[])
        for sub in s['subsystems']:
            subo = OrderedDict(name=sub['name'], nameKo=SUBSYSTEM_KO.get(sub['name'], sub['name']), groups=[])
            for g in sub['groups']:
                gid = slugify(g['name'])
                if gid in used_ids or g['name'] in AMBIGUOUS_GROUP_NAMES:
                    gid = f'{sid}-{gid}'
                used_ids.add(gid)
                for pn in g['imagePages']:
                    groups_by_page.setdefault(pn, gid)
                total_parts += len(g['parts'])
                pns.update(p['pn'] for p in g['parts'])
                go = OrderedDict(id=gid, name=g['name'], nameKo=GROUP_KO.get(g['name'], g['name']),
                                 pages=g['pages'], images=[], parts=g['parts'])
                subo['groups'].append(go)
                if g['name'] not in GROUP_KO:
                    print(f'  ! missing Korean name for group: {g["name"]}', file=sys.stderr)
            so['subsystems'].append(subo)
        out_systems.append(so)

    print('Extracting illustrations', file=sys.stderr)
    images = extract_images(pdf_path, groups_by_page)
    for s in out_systems:
        for sub in s['subsystems']:
            for g in sub['groups']:
                g['images'] = images.get(g['id'], [])

    catalog = OrderedDict(
        meta=OrderedDict(
            title='Model S Parts Catalog (North America, 2012-2016)',
            source=os.path.basename(pdf_path),
            sourceDate='2018-02-15',
            categories=CATEGORY_NOTES,
            symbols={'*': '일러스트에 표시되지 않음 (Not illustrated)', '**': '필요 수량 (As needed)'},
            stats=OrderedDict(systems=len(out_systems),
                              groups=sum(len(sub['groups']) for s in out_systems for sub in s['subsystems']),
                              rows=total_parts, uniquePartNumbers=len(pns)),
        ),
        systems=out_systems,
    )
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))
    print(f'Wrote {OUT_JSON}: {catalog["meta"]["stats"]}', file=sys.stderr)


if __name__ == '__main__':
    main()
