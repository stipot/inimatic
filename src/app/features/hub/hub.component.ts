import { Component, OnInit } from '@angular/core';
import { SkillHostService } from '../../skill-host/skill-host.service';
import { hubPingSkill } from '../../skills/hub-ping.skill';
import { CommonModule } from '@angular/common';
import { SkillOutletComponent } from 'src/app/skill-host/skill-outlet.component';

@Component({
	selector: 'app-hub',
	standalone: true,
	template: `
  <div class="p-3">
    <h2>HUB</h2>
    <skill-outlet [skill]="'hub-ping'"></skill-outlet>
  </div>`,
	imports: [CommonModule, SkillOutletComponent],
})
export class HubComponent implements OnInit {
	constructor(private host: SkillHostService) { }
	ngOnInit() { this.host.register(hubPingSkill); }
}
